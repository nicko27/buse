#!/bin/bash

set -euo pipefail

# --- Couleurs Terminal ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- Variables globales par défaut ---
DEFAULT_BRANCH="master"
DEFAULT_REMOTE="origin"
DEFAULT_TIMEOUT=30
LOCK_FILE="/tmp/push.lock"
BACKUP_DIR=".git/backups"
MAX_BACKUPS=0
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
CONFIG_FILE=".git/push.config"
DEBUG_MODE=false
NO_BACKUP=true
TIMEOUT="$DEFAULT_TIMEOUT"
MIN_DISK_SPACE_MB=100  # Espace disque minimum requis en MB

# --- Variables d'état d'exécution ---
PUSH_ALL=false
PUSH_MAIN=false
PUSH_SUBMODULES=false
NO_CONFIRM=false
SPECIFIED_BRANCH=""
SPECIFIED_REMOTE=""
INTERACTIVE_MODE=false
SHOW_CONFIG=false
SHOW_HELP=false
GIT_TOPLEVEL=""

# --- Fonctions de log ---
log_info()    { echo -e "$1"; }
log_error()   { echo -e "${RED}❌ Erreur: $1${NC}" >&2; }
log_warn()    { echo -e "${YELLOW}⚠️  $1${NC}" >&2; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_debug()   { [[ "$DEBUG_MODE" == "true" ]] && echo -e "${CYAN}[DEBUG]${NC} $1"; }

# --- Fonctions de vérification ---
check_disk_space() {
    local dir="$1"
    local required_space=$MIN_DISK_SPACE_MB
    
    # Créer le répertoire s'il n'existe pas
    mkdir -p "$dir"
    
    # Obtenir le chemin absolu du répertoire parent
    local parent_dir=$(dirname "$dir")
    local abs_parent_dir=$(cd "$parent_dir" && pwd)
    
    # Vérifier l'espace disponible en MB
    local available_space
    if ! available_space=$(df -m "$abs_parent_dir" 2>/dev/null | awk 'NR==2 {print $4}'); then
        log_error "Impossible de vérifier l'espace disque pour $dir"
        return 1
    fi
    
    if [[ -z "$available_space" ]]; then
        log_error "Impossible de déterminer l'espace disponible"
        return 1
    fi
    
    if [[ $available_space -lt $required_space ]]; then
        log_error "Espace disque insuffisant. Disponible: ${available_space}MB, Requis: ${required_space}MB"
        return 1
    fi
    
    log_debug "Espace disque suffisant: ${available_space}MB disponible"
    return 0
}

acquire_lock() {
    if [[ -f "$LOCK_FILE" ]]; then
        local pid=$(cat "$LOCK_FILE" 2>/dev/null)
        if ps -p "$pid" >/dev/null 2>&1; then
            log_error "Une autre instance du script est en cours d'exécution (PID: $pid)"
            return 1
        fi
    fi
    echo "$$" > "$LOCK_FILE"
    return 0
}

# --- Nettoyage ---
cleanup_and_exit() {
    [[ -f "$LOCK_FILE" && "$(cat "$LOCK_FILE" 2>/dev/null)" == "$$" ]] && rm -f "$LOCK_FILE"
    exit "$1"
}

# --- Aide ---
show_help() {
    cat <<EOF
Usage : $0 [options]

Options :
  -a, --all               Pousser projet principal et tous les sous-modules
  -m, --main              Pousser uniquement le projet principal
  -s, --submodules        Pousser uniquement les sous-modules
  -n, --no-confirm        Ne pas demander de confirmation
  --branch=BRANCHE        Forcer une branche (ex: develop)
  --remote=REMOTE         Forcer un remote (ex: origin)
  --no-backup             Ne pas créer de backup
  --debug                 Activer le mode debug
  --interactive           Configuration interactive
  -S, --show-config       Afficher la configuration actuelle
  -h, --help              Afficher l'aide
  --submodule=chemin:nom  Pousser un sous-module spécifique
EOF
    cleanup_and_exit 0
}

# --- Parseur d'arguments ---
for arg in "$@"; do
    case "$arg" in
        -a|--all) PUSH_ALL=true ;;
        -m|--main) PUSH_MAIN=true ;;
        -s|--submodules) PUSH_SUBMODULES=true ;;
        -n|--no-confirm) NO_CONFIRM=true ;;
        --branch=*) SPECIFIED_BRANCH="${arg#*=}" ;;
        --remote=*) SPECIFIED_REMOTE="${arg#*=}" ;;
        --no-backup) NO_BACKUP=true ;;
        --debug) DEBUG_MODE=true ;;
        --interactive) INTERACTIVE_MODE=true ;;
        -S|--show-config) SHOW_CONFIG=true ;;
        -h|--help) SHOW_HELP=true ;;
        --submodule=*) 
            val="${arg#*=}"
            path="${val%%:*}"
            name="${val#*:}"
            check_prerequisites
            set_git_toplevel
            check_timeout_cmd
            load_config "$CONFIG_FILE"
            process_submodule "$path" "$name"
            cleanup_and_exit 0
            ;;
        *) log_warn "Option inconnue ignorée: $arg" ;;
    esac
done

# --- Fonctions système ---
check_prerequisites() {
    if ! command -v git >/dev/null; then
        log_error "Git non trouvé."
        exit 1
    fi
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        log_error "Pas un dépôt git."
        exit 1
    fi
}

set_git_toplevel() {
    GIT_TOPLEVEL="$(git rev-parse --show-toplevel)"
    CONFIG_FILE="$GIT_TOPLEVEL/$CONFIG_FILE"
    BACKUP_DIR="$GIT_TOPLEVEL/${BACKUP_DIR#.}"
    cd "$GIT_TOPLEVEL"
}

check_timeout_cmd() {
    command -v timeout >/dev/null && TIMEOUT_CMD="timeout" || TIMEOUT_CMD=""
}

load_config() {
    [[ -f "$1" ]] && source "$1" || log_debug "Aucun fichier de config trouvé, valeurs par défaut utilisées."
}

# --- Fonctions de backup ---
cleanup_old_backups() {
    local backup_dir="$1"
    local max_backups="$2"
    
    if [[ ! -d "$backup_dir" ]]; then
        mkdir -p "$backup_dir"
        return 0
    fi
    
    # Si max_backups est 0, ne pas supprimer les anciens backups
    if [[ "$max_backups" == "0" ]]; then
        return 0
    fi
    
    # Supprimer les anciens backups si on dépasse MAX_BACKUPS
    find "$backup_dir" -type f -name "*.tgz" -printf "%T@ %p\n" | \
    sort -nr | \
    tail -n +$((max_backups + 1)) | \
    cut -d' ' -f2- | \
    xargs -r rm -f
}

create_backup() {
    local backup_dir="$1"
    local name="$2"
    local timestamp=$(date +%F_%H%M%S)
    local backup_file="$backup_dir/${name}_${timestamp}.tgz"
    
    # Créer le répertoire de backup s'il n'existe pas
    mkdir -p "$backup_dir"
    
    # Créer un répertoire temporaire pour le backup
    local temp_dir=$(mktemp -d)
    if ! cp -R . "$temp_dir/" 2>/dev/null; then
        rm -rf "$temp_dir"
        log_error "Impossible de copier les fichiers pour le backup"
        return 1
    fi
    
    # Créer l'archive depuis le répertoire temporaire
    if ! (cd "$temp_dir" && tar czf "$backup_file" . --exclude=.git); then
        rm -rf "$temp_dir"
        log_error "Backup échoué pour $name"
        return 1
    fi
    
    # Nettoyer
    rm -rf "$temp_dir"
    
    cleanup_old_backups "$backup_dir" "$MAX_BACKUPS"
    return 0
}

# --- Configuration interactive ---
configure_interactive() {
    log_info "🛠️  Mode configuration interactive :"
    
    # Charger la configuration existante si elle existe
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    fi
    
    # Fonction pour lire une valeur avec une valeur par défaut
    read_with_default() {
        local prompt="$1"
        local default="$2"
        local value
        read -p "$prompt [$default] : " value
        echo "${value:-$default}"
    }
    
    # Lire les valeurs avec les valeurs par défaut
    local input_branch=$(read_with_default "Branche par défaut" "$DEFAULT_BRANCH")
    local input_remote=$(read_with_default "Remote par défaut" "$DEFAULT_REMOTE")
    local input_backup=$(read_with_default "Répertoire de backup" "$BACKUP_DIR")
    local input_max=$(read_with_default "Nombre max de backups (0 pour désactiver)" "$MAX_BACKUPS")
    local input_conflicts=$(read_with_default "Activer vérification conflits (true/false)" "$CONFLICT_CHECK")
    local input_branch_check=$(read_with_default "Activer vérification branche (true/false)" "$BRANCH_CHECK")
    local input_remote_check=$(read_with_default "Activer vérification remote (true/false)" "$REMOTE_CHECK")
    
    # Créer le répertoire de configuration s'il n'existe pas
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    {
        echo "DEFAULT_BRANCH=\"$input_branch\""
        echo "DEFAULT_REMOTE=\"$input_remote\""
        echo "BACKUP_DIR=\"$input_backup\""
        echo "MAX_BACKUPS=\"$input_max\""
        echo "CONFLICT_CHECK=\"$input_conflicts\""
        echo "BRANCH_CHECK=\"$input_branch_check\""
        echo "REMOTE_CHECK=\"$input_remote_check\""
    } > "$CONFIG_FILE"
    
    log_success "Configuration sauvegardée dans $CONFIG_FILE"
    cleanup_and_exit 0
}

# --- Affichage config ---
show_current_config() {
    log_info ""
    log_info "📋 Configuration actuelle :"
    [[ -f "$CONFIG_FILE" ]] && cat "$CONFIG_FILE" || log_warn "Aucune configuration trouvée."
    cleanup_and_exit 0
}

# --- Traitement des sous-modules spécifiques ---
process_submodule() {
    local path="$1"
    local name="$2"
    
    if [[ ! -d "$path" ]]; then
        log_error "Le sous-module $path n'existe pas"
        cleanup_and_exit 1
    fi
    
    log_info "🔁 Traitement du sous-module: $name ($path)"
    cd "$path"
    
    if git status --porcelain | grep -q .; then
        if [[ "$NO_CONFIRM" != true ]]; then
            read -p "Pousser $name ? (o/n) " answer
            [[ "$answer" != [oOyY]* ]] && log_info "Annulé." && cleanup_and_exit 0
        fi
        
        if [[ "$NO_BACKUP" != true ]]; then
            create_backup "$BACKUP_DIR" "$name" || { 
                echo "❌ Backup échoué pour $name"
                exit 1
            }
        fi
        
        git add .
        if ! git commit -m "Auto commit $name - $(date '+%F %T')"; then
            [[ $? -eq 1 ]] && log_info "Rien à commit." || { 
                log_error "Erreur de commit dans $name"
                cleanup_and_exit 1
            }
        fi
        
        git push || { 
            log_error "Échec du push de $name"
            cleanup_and_exit 1
        }
        log_success "$name poussé."
    else
        log_info "Aucun changement à pousser dans $name."
    fi
    
    cd "$GIT_TOPLEVEL"
}

# --- Lancement ---
[[ "$SHOW_HELP" == true ]] && show_help
check_prerequisites
set_git_toplevel
check_timeout_cmd
[[ "$INTERACTIVE_MODE" == true ]] && configure_interactive
[[ "$SHOW_CONFIG" == true ]] && show_current_config
load_config "$CONFIG_FILE"

# Vérifier le lock file
acquire_lock || cleanup_and_exit 1

# Vérifier l'espace disque si backup activé
if [[ "$NO_BACKUP" != true ]]; then
    check_disk_space "$BACKUP_DIR" || cleanup_and_exit 1
fi

# --- Traitement du projet principal ---
if [[ "$PUSH_ALL" == true || "$PUSH_MAIN" == true ]]; then
    log_info ""
    log_info "🚀 Traitement du projet principal"

    if [[ "$CONFLICT_CHECK" == true && $(git diff --name-only --diff-filter=U) ]]; then
        log_error "Conflits détectés dans le projet principal"
        cleanup_and_exit 1
    fi

    if [[ "$BRANCH_CHECK" == true && -n "$SPECIFIED_BRANCH" ]]; then
        current_branch=$(git rev-parse --abbrev-ref HEAD)
        if [[ "$current_branch" != "$SPECIFIED_BRANCH" ]]; then
            log_error "Branche active: $current_branch, attendu: $SPECIFIED_BRANCH"
            cleanup_and_exit 1
        fi
    fi

    if [[ "$REMOTE_CHECK" == true && -n "$SPECIFIED_REMOTE" ]]; then
        git remote | grep -q "^$SPECIFIED_REMOTE$" || { log_error "Remote '$SPECIFIED_REMOTE' non trouvé"; cleanup_and_exit 1; }
    fi

    if git status --porcelain | grep -q .; then
        if [[ "$NO_CONFIRM" != true ]]; then
            read -p "Confirmer commit & push du projet principal ? (o/n) " confirm
            [[ "$confirm" != [oOyY]* ]] && log_info "Annulé." && cleanup_and_exit 0
        fi

        git add .
        git commit -m "Auto commit - $(date '+%F %T')" || log_info "Rien à commit."
        git push "${SPECIFIED_REMOTE:-$DEFAULT_REMOTE}" "${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}" || { log_error "Échec du push."; cleanup_and_exit 1; }

        log_success "Push principal effectué avec succès."
    else
        log_info "Aucun changement à pousser dans le projet principal."
    fi
fi

# --- Traitement des sous-modules ---
if [[ "$PUSH_ALL" == true || "$PUSH_SUBMODULES" == true ]]; then
    export NO_CONFIRM NO_BACKUP GIT_TOPLEVEL
    git submodule foreach --quiet '
        name=$(basename "$sm_path")
        echo -e "\n🔁 Sous-module: $name ($sm_path)"

        if git status --porcelain | grep -q .; then
            if [[ "$NO_CONFIRM" != true ]]; then
                read -p "Pousser $name ? (o/n) " answer
                [[ "$answer" != [oOyY]* ]] && echo "Annulé." && exit 0
            fi

            git add .
            if ! git commit -m "Auto commit $name - $(date '+%F %T')"; then
                [[ $? -eq 1 ]] && echo "Rien à commit." || { 
                    echo "❌ Erreur de commit dans $name"
                    exit 1
                }
            fi

            git push || { 
                echo "❌ Échec du push de $name"
                exit 1
            }
            echo "✅ $name poussé."
        else
            echo "Aucun changement à pousser dans $name."
        fi
    '
fi

log_success "Opérations terminées."
cleanup_and_exit 0
