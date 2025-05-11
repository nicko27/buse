#!/bin/bash

set -euo pipefail

# --- Couleurs Terminal ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

# --- Variables globales par défaut ---
DEFAULT_BRANCH="master"
DEFAULT_REMOTE="origin"
DEFAULT_TIMEOUT=30
LOCK_FILE="/tmp/push.lock"
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
CONFIG_FILE=".git/push.config"
DEBUG_MODE=false
TIMEOUT="$DEFAULT_TIMEOUT"

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
log_debug()   { 
    if [[ "$DEBUG_MODE" == "true" ]]; then
        local timestamp=$(date '+%H:%M:%S')
        local caller_info=$(caller 0)
        local line_number=${caller_info%% *}
        local function_name=${caller_info#* }
        echo -e "${BLUE}[DEBUG ${timestamp}]${NC} ${CYAN}${function_name}:${line_number}${NC} $1"
    fi
}

# --- Fonctions de debug ---
debug_show_vars() {
    if [[ "$DEBUG_MODE" == "true" ]]; then
        log_debug "Variables de configuration :"
        log_debug "  DEFAULT_BRANCH: $DEFAULT_BRANCH"
        log_debug "  DEFAULT_REMOTE: $DEFAULT_REMOTE"
        log_debug "  CONFLICT_CHECK: $CONFLICT_CHECK"
        log_debug "  BRANCH_CHECK: $BRANCH_CHECK"
        log_debug "  REMOTE_CHECK: $REMOTE_CHECK"
        log_debug "  CONFIG_FILE: $CONFIG_FILE"
        log_debug "  GIT_TOPLEVEL: $GIT_TOPLEVEL"
        log_debug "Variables d'état :"
        log_debug "  PUSH_ALL: $PUSH_ALL"
        log_debug "  PUSH_MAIN: $PUSH_MAIN"
        log_debug "  PUSH_SUBMODULES: $PUSH_SUBMODULES"
        log_debug "  NO_CONFIRM: $NO_CONFIRM"
        log_debug "  SPECIFIED_BRANCH: $SPECIFIED_BRANCH"
        log_debug "  SPECIFIED_REMOTE: $SPECIFIED_REMOTE"
    fi
}

debug_show_git_status() {
    if [[ "$DEBUG_MODE" == "true" ]]; then
        log_debug "État Git :"
        log_debug "  Branche actuelle: $(git rev-parse --abbrev-ref HEAD)"
        log_debug "  Remotes: $(git remote | tr '\n' ' ')"
        log_debug "  Modifications:"
        git status --porcelain | while read -r line; do
            log_debug "    $line"
        done
    fi
}

# --- Nettoyage ---
cleanup_and_exit() {
    [[ -f "$LOCK_FILE" && "$(cat "$LOCK_FILE" 2>/dev/null)" == "$$" ]] && rm -f "$LOCK_FILE"
    log_debug "Nettoyage effectué"
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
    log_debug "Vérification des prérequis"
    if ! command -v git >/dev/null; then
        log_error "Git non trouvé."
        exit 1
    fi
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        log_error "Pas un dépôt git."
        exit 1
    fi
    log_debug "Prérequis vérifiés"
}

set_git_toplevel() {
    log_debug "Configuration du répertoire Git"
    GIT_TOPLEVEL="$(git rev-parse --show-toplevel)"
    CONFIG_FILE="$GIT_TOPLEVEL/$CONFIG_FILE"
    cd "$GIT_TOPLEVEL"
    log_debug "Répertoire Git configuré: $GIT_TOPLEVEL"
}

check_timeout_cmd() {
    log_debug "Vérification de la commande timeout"
    command -v timeout >/dev/null && TIMEOUT_CMD="timeout" || TIMEOUT_CMD=""
    log_debug "Commande timeout: $TIMEOUT_CMD"
}

load_config() {
    log_debug "Chargement de la configuration"
    [[ -f "$1" ]] && source "$1" || log_debug "Aucun fichier de config trouvé, valeurs par défaut utilisées."
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
    local input_conflicts=$(read_with_default "Activer vérification conflits (true/false)" "$CONFLICT_CHECK")
    local input_branch_check=$(read_with_default "Activer vérification branche (true/false)" "$BRANCH_CHECK")
    local input_remote_check=$(read_with_default "Activer vérification remote (true/false)" "$REMOTE_CHECK")
    
    # Créer le répertoire de configuration s'il n'existe pas
    mkdir -p "$(dirname "$CONFIG_FILE")"
    
    {
        echo "DEFAULT_BRANCH=\"$input_branch\""
        echo "DEFAULT_REMOTE=\"$input_remote\""
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

# Afficher les informations de debug
debug_show_vars
debug_show_git_status

# Vérifier le lock file
if [[ -f "$LOCK_FILE" ]]; then
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null)
    log_debug "Vérification du lock file (PID: $LOCK_PID)"
    if ps -p "$LOCK_PID" >/dev/null 2>&1; then
        log_error "Une autre instance du script est en cours d'exécution (PID: $LOCK_PID)"
        cleanup_and_exit 1
    fi
fi
echo "$$" > "$LOCK_FILE"
log_debug "Lock file créé (PID: $$)"

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
            if [[ "$confirm" != [oOyY]* ]]; then
                log_info "Annulé pour le projet principal."
                # Si on a utilisé -a, on continue avec les sous-modules
                if [[ "$PUSH_ALL" == true ]]; then
                    log_info "Continuing avec les sous-modules..."
                else
                    cleanup_and_exit 0
                fi
            else
                git add .
                git commit -m "Auto commit - $(date '+%F %T')" || log_info "Rien à commit."
                git push "${SPECIFIED_REMOTE:-$DEFAULT_REMOTE}" "${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}" || { log_error "Échec du push."; cleanup_and_exit 1; }
                log_success "Push principal effectué avec succès."
            fi
        else
            git add .
            git commit -m "Auto commit - $(date '+%F %T')" || log_info "Rien à commit."
            git push "${SPECIFIED_REMOTE:-$DEFAULT_REMOTE}" "${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}" || { log_error "Échec du push."; cleanup_and_exit 1; }
            log_success "Push principal effectué avec succès."
        fi
    else
        log_info "Aucun changement à pousser dans le projet principal."
    fi
fi

# --- Traitement des sous-modules ---
if [[ "$PUSH_ALL" == true || "$PUSH_SUBMODULES" == true ]]; then
    export NO_CONFIRM GIT_TOPLEVEL DEFAULT_BRANCH SPECIFIED_BRANCH
    git submodule foreach --quiet '
        name=$(basename "$sm_path")
        echo  "\n🔁 Sous-module: $name ($sm_path)"

        # Correction HEAD détaché
        branch_to_checkout="${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}"
        current_branch=$(git rev-parse --abbrev-ref HEAD)
        if [[ "$current_branch" == "HEAD" ]]; then
            echo "${YELLOW}⚠️  HEAD détaché détecté, tentative de checkout sur $branch_to_checkout...${NC}"
            git fetch origin "$branch_to_checkout"
            git checkout "$branch_to_checkout" || {
                echo "${RED}❌ Impossible de checkout la branche $branch_to_checkout dans $name${NC}";
                exit 1;
            }
        fi

        if git status --porcelain | grep -q .; then
            if [[ "$NO_CONFIRM" != true ]]; then
                read -p "Pousser $name ? (o/n) " answer
                [[ "$answer" != [oOyY]* ]] && echo "Annulé." && exit 0
            fi

            git add .
            if ! git commit -m "Auto commit $name - $(date "+%F %T")"; then
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
