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
MAX_BACKUPS=5
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
CONFIG_FILE=".git/push.config"
DEBUG_MODE=false
NO_BACKUP=false
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
log_debug()   { [[ "$DEBUG_MODE" == "true" ]] && echo -e "${CYAN}[DEBUG]${NC} $1"; }

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
    command -v git >/dev/null || log_error "Git non trouvé." && exit 1
    git rev-parse --is-inside-work-tree >/dev/null 2>&1 || log_error "Pas un dépôt git." && exit 1
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

# --- Configuration interactive ---
configure_interactive() {
    log_info "🛠️  Mode configuration interactive :"
    read -p "Branche par défaut [$DEFAULT_BRANCH] : " input_branch
    read -p "Remote par défaut [$DEFAULT_REMOTE] : " input_remote
    read -p "Répertoire de backup [$BACKUP_DIR] : " input_backup
    read -p "Nombre max de backups [$MAX_BACKUPS] : " input_max
    read -p "Activer vérification conflits (true/false) [$CONFLICT_CHECK] : " input_conflicts
    read -p "Activer vérification branche (true/false) [$BRANCH_CHECK] : " input_branch_check
    read -p "Activer vérification remote (true/false) [$REMOTE_CHECK] : " input_remote_check

    {
        echo "DEFAULT_BRANCH=\"${input_branch:-$DEFAULT_BRANCH}\""
        echo "DEFAULT_REMOTE=\"${input_remote:-$DEFAULT_REMOTE}\""
        echo "DEFAULT_BACKUP_DIR=\"${input_backup:-$BACKUP_DIR}\""
        echo "DEFAULT_MAX_BACKUPS=\"${input_max:-$MAX_BACKUPS}\""
        echo "DEFAULT_CONFLICT_CHECK=\"${input_conflicts:-$CONFLICT_CHECK}\""
        echo "DEFAULT_BRANCH_CHECK=\"${input_branch_check:-$BRANCH_CHECK}\""
        echo "DEFAULT_REMOTE_CHECK=\"${input_remote_check:-$REMOTE_CHECK}\""
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

# --- Lancement ---
[[ "$SHOW_HELP" == true ]] && show_help
check_prerequisites
set_git_toplevel
check_timeout_cmd
[[ "$INTERACTIVE_MODE" == true ]] && configure_interactive
[[ "$SHOW_CONFIG" == true ]] && show_current_config
load_config "$CONFIG_FILE"

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

        [[ "$NO_BACKUP" != true ]] && mkdir -p "$BACKUP_DIR" && tar czf "$BACKUP_DIR/main_$(date +%F_%H%M%S).tgz" . --exclude=".git" || { log_error "Backup échoué"; cleanup_and_exit 1; }

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
    NO_CONFIRM="$NO_CONFIRM" NO_BACKUP="$NO_BACKUP" BACKUP_DIR="$BACKUP_DIR" bash -c '
        git submodule foreach --quiet "
            name=\$(basename \"\$sm_path\")
            echo -e \"\n🔁 Sous-module: \$name (\$sm_path)\"

            if git status --porcelain | grep -q .; then
                if [[ \"\$NO_CONFIRM\" != true ]]; then
                    read -p \"Pousser \$name ? (o/n) \" answer
                    [[ \"\$answer\" != [oOyY]* ]] && echo \"Annulé.\" && exit 0
                fi

                if [[ \"\$NO_BACKUP\" != true ]]; then
                    mkdir -p \"\$BACKUP_DIR\"
                    tar czf \"\$BACKUP_DIR/\${name}_\$(date +%F_%H%M%S).tgz\" . --exclude=.git || { echo \"❌ Backup échoué pour \$name\"; exit 1; }
                fi

                git add .
                if ! git commit -m \"Auto commit \$name - \$(date '+%F %T')\"; then
                    [[ \$? -eq 1 ]] && echo \"Rien à commit.\" || { echo \"❌ Erreur de commit dans \$name\"; exit 1; }
                fi

                git push || { echo \"⚠️  Échec du push de \$name\"; exit 1; }
                echo \"✅ \$name poussé.\"
            else
                echo \"Aucun changement à pousser dans \$name.\"
            fi
        "
    '
fi

log_success "Opérations terminées."
cleanup_and_exit 0
