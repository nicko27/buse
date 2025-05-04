#!/bin/bash

set -euo pipefail

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m' # Added Cyan for debug
NC='\033[0m' # No Color

# Configuration Defaults (can be overridden by file or args)
MAX_DIFF_LINES=10
DEFAULT_TIMEOUT=30
LOCK_FILE="/tmp/push.lock"
BACKUP_DIR=".git/backups"
MAX_BACKUPS=5
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
CONFIG_FILE=".git/push.config"
DEBUG_MODE=false # Added Debug Mode flag

# --- Logging Functions ---
# Always visible log
log_info() {
    echo -e "$1"
}
# Error log (always visible)
log_error() {
    echo -e "${RED}❌ Erreur: $1${NC}" >&2
}
# Warning log (always visible)
log_warn() {
     echo -e "${YELLOW}⚠️  $1${NC}" >&2 # Keep warnings visible
}
# Success log (always visible)
log_success() {
     echo -e "${GREEN}✅ $1${NC}"
}
# Debug log (only visible if DEBUG_MODE is true)
log_debug() {
    if [[ "$DEBUG_MODE" == "true" ]]; then
        # Use Cyan for debug messages
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}
# --- End Logging Functions ---


# Vérification de la commande timeout
if ! command -v timeout &> /dev/null; then
    log_warn "La commande 'timeout' n'est pas disponible, désactivation des timeouts"
    TIMEOUT_CMD=""
else
    TIMEOUT_CMD="timeout"
fi

# Fonction pour charger la configuration
load_config() {
    local config_file=$1
    log_debug "Chargement de la configuration depuis '$config_file'..."
    if [ -f "$config_file" ]; then
        # Use source, handle potential errors during source? Maybe not needed with set -e
        if source "$config_file"; then
            log_debug "Configuration chargée avec succès."
            # Initialiser les variables actuelles à partir des valeurs par défaut si non définies dans le fichier
            BACKUP_DIR=${DEFAULT_BACKUP_DIR:-${BACKUP_DIR:-.git/backups}} # Prioritize loaded value if exists
            MAX_BACKUPS=${DEFAULT_MAX_BACKUPS:-${MAX_BACKUPS:-5}}
            CONFLICT_CHECK=${DEFAULT_CONFLICT_CHECK:-${CONFLICT_CHECK:-true}}
            BRANCH_CHECK=${DEFAULT_BRANCH_CHECK:-${BRANCH_CHECK:-true}}
            REMOTE_CHECK=${DEFAULT_REMOTE_CHECK:-${REMOTE_CHECK:-true}}
            # Debug flag can also be set in config file if needed
            # DEBUG_MODE=${DEFAULT_DEBUG_MODE:-${DEBUG_MODE:-false}}
        else
             log_warn "Erreur lors du chargement du fichier de configuration '$config_file'. Utilisation des valeurs par défaut."
             # Ensure defaults are set if sourcing fails
             BACKUP_DIR=${BACKUP_DIR:-.git/backups}
             MAX_BACKUPS=${MAX_BACKUPS:-5}
             CONFLICT_CHECK=${CONFLICT_CHECK:-true}
             BRANCH_CHECK=${BRANCH_CHECK:-true}
             REMOTE_CHECK=${REMOTE_CHECK:-true}
        fi
    else
         log_debug "Fichier de configuration '$config_file' non trouvé. Utilisation des valeurs par défaut."
         # Explicitly set defaults if file doesn't exist
         BACKUP_DIR=${BACKUP_DIR:-.git/backups}
         MAX_BACKUPS=${MAX_BACKUPS:-5}
         CONFLICT_CHECK=${CONFLICT_CHECK:-true}
         BRANCH_CHECK=${BRANCH_CHECK:-true}
         REMOTE_CHECK=${REMOTE_CHECK:-true}
    fi
     log_debug "Configuration après chargement: BACKUP_DIR='$BACKUP_DIR', MAX_BACKUPS='$MAX_BACKUPS', CONFLICT_CHECK='$CONFLICT_CHECK', BRANCH_CHECK='$BRANCH_CHECK', REMOTE_CHECK='$REMOTE_CHECK'"
}

# Fonction pour sauvegarder la configuration
save_config() {
    local config_file=$1
    log_debug "Sauvegarde de la configuration dans '$config_file'..."
    cat > "$config_file" << EOF
# Configuration sauvegardée le $(date)
DEFAULT_BRANCH="$DEFAULT_BRANCH"
DEFAULT_REMOTE="$DEFAULT_REMOTE"
DEFAULT_BACKUP_DIR="$BACKUP_DIR"
DEFAULT_MAX_BACKUPS="$MAX_BACKUPS"
DEFAULT_CONFLICT_CHECK="$CONFLICT_CHECK"
DEFAULT_BRANCH_CHECK="$BRANCH_CHECK"
DEFAULT_REMOTE_CHECK="$REMOTE_CHECK"
# Optional: Save debug mode preference?
# DEFAULT_DEBUG_MODE="$DEBUG_MODE"
EOF
    log_success "Configuration sauvegardée dans $config_file" # Keep this visible
}

# Fonction pour configurer interactivement
configure_interactive() {
    log_info "${BLUE}📝 Configuration interactive${NC}"

    read -p "Fichier de configuration [${CONFIG_FILE:-.git/push.config}] : " input_config_file
    CONFIG_FILE=${input_config_file:-${CONFIG_FILE:-.git/push.config}}
    log_debug "Utilisation du fichier de configuration: $CONFIG_FILE"

    # Initialize defaults before loading potentially incomplete file
    local current_branch_default="master"
    local current_remote_default="origin"
    local current_backup_dir_default=".git/backups"
    local current_max_backups_default="5"
    local current_conflict_check_default="true"
    local current_branch_check_default="true"
    local current_remote_check_default="true"

    if [ -f "$CONFIG_FILE" ]; then
        log_info "${GREEN}Chargement de la configuration existante...${NC}" # Keep visible
        # Use "." instead of source for better compatibility
        . "$CONFIG_FILE"
        # Update current defaults from loaded file if present
        current_branch_default=${DEFAULT_BRANCH:-$current_branch_default}
        current_remote_default=${DEFAULT_REMOTE:-$current_remote_default}
        current_backup_dir_default=${DEFAULT_BACKUP_DIR:-$current_backup_dir_default}
        current_max_backups_default=${DEFAULT_MAX_BACKUPS:-$current_max_backups_default}
        current_conflict_check_default=${DEFAULT_CONFLICT_CHECK:-$current_conflict_check_default}
        current_branch_check_default=${DEFAULT_BRANCH_CHECK:-$current_branch_check_default}
        current_remote_check_default=${DEFAULT_REMOTE_CHECK:-$current_remote_check_default}
    else
        log_warn "Création d'une nouvelle configuration..." # Keep visible
    fi

    # Use current defaults for prompts
    local conflict_check_prompt=$( [[ "$current_conflict_check_default" == "true" ]] && echo "o" || echo "n" )
    local branch_check_prompt=$( [[ "$current_branch_check_default" == "true" ]] && echo "o" || echo "n" )
    local remote_check_prompt=$( [[ "$current_remote_check_default" == "true" ]] && echo "o" || echo "n" )

    # Prompts (remain visible)
    read -p "Branche par défaut [$current_branch_default] : " input_branch
    DEFAULT_BRANCH=${input_branch:-$current_branch_default}

    read -p "Remote par défaut [$current_remote_default] : " input_remote
    DEFAULT_REMOTE=${input_remote:-$current_remote_default}

    read -p "Répertoire de backup [$current_backup_dir_default] : " input_backup_dir
    DEFAULT_BACKUP_DIR=${input_backup_dir:-$current_backup_dir_default}

    read -p "Nombre maximum de backups [$current_max_backups_default] : " input_max_backups
    input_max_backups=${input_max_backups:-$current_max_backups_default}
    if ! [[ "$input_max_backups" =~ ^[0-9]+$ ]]; then
        log_error "Le nombre de backups doit être un nombre entier, utilisation de $current_max_backups_default"
        DEFAULT_MAX_BACKUPS=$current_max_backups_default
    else
        DEFAULT_MAX_BACKUPS=$input_max_backups
    fi

    read -p "Vérifier les conflits ? (o/n) [$conflict_check_prompt] : " input_conflict
    input_conflict=${input_conflict:-$conflict_check_prompt}
    [[ "$input_conflict" =~ ^[oOyY]$ ]] && DEFAULT_CONFLICT_CHECK="true" || DEFAULT_CONFLICT_CHECK="false"

    read -p "Vérifier les branches ? (o/n) [$branch_check_prompt] : " input_branch_check
    input_branch_check=${input_branch_check:-$branch_check_prompt}
    [[ "$input_branch_check" =~ ^[oOyY]$ ]] && DEFAULT_BRANCH_CHECK="true" || DEFAULT_BRANCH_CHECK="false"

    read -p "Vérifier les remotes ? (o/n) [$remote_check_prompt] : " input_remote_check
    input_remote_check=${input_remote_check:-$remote_check_prompt}
    [[ "$input_remote_check" =~ ^[oOyY]$ ]] && DEFAULT_REMOTE_CHECK="true" || DEFAULT_REMOTE_CHECK="false"

    # Update runtime variables immediately
    BACKUP_DIR=$DEFAULT_BACKUP_DIR
    MAX_BACKUPS=$DEFAULT_MAX_BACKUPS
    CONFLICT_CHECK=$DEFAULT_CONFLICT_CHECK
    BRANCH_CHECK=$DEFAULT_BRANCH_CHECK
    REMOTE_CHECK=$DEFAULT_REMOTE_CHECK

    # Save configuration
    save_config "$CONFIG_FILE"
}

# Fonction pour afficher la configuration actuelle
show_config() {
    # Ensure config is loaded before showing
    load_config "$CONFIG_FILE" # load_config provides debug output
    log_info "${BLUE}📋 Configuration actuelle :${NC}" # Keep visible
    log_info "Fichier de configuration : ${CONFIG_FILE:-Non défini}"
    log_info "Branche par défaut : ${DEFAULT_BRANCH:-master}"
    log_info "Remote par défaut : ${DEFAULT_REMOTE:-origin}"
    log_info "Répertoire de backup : ${BACKUP_DIR:-.git/backups}"
    log_info "Nombre maximum de backups : ${MAX_BACKUPS:-5}"
    log_info "Vérification des conflits : ${CONFLICT_CHECK:-true}"
    log_info "Vérification des branches : ${BRANCH_CHECK:-true}"
    log_info "Vérification des remotes : ${REMOTE_CHECK:-true}"
    log_info "Mode Debug : ${DEBUG_MODE}" # Show debug status
}


# Fonction pour afficher l'aide
show_help() {
    # Ensure config is loaded to show correct defaults in help
    load_config "$CONFIG_FILE"
    echo -e "${BLUE}Usage: $0 [options]${NC}"
    echo -e "${BLUE}Options:${NC}"
    echo "  -h, --help              Affiche cette aide"
    echo "  -d, --debug             Active le mode debug (plus de logs)" # New option
    echo "  -c, --config=FILE       Utilise le fichier de configuration spécifié (défaut: ${CONFIG_FILE:-.git/push.config})"
    echo "  -i, --interactive       Configure ou modifie le fichier de configuration"
    echo "  -S, --show-config       Affiche la configuration actuelle (depuis ${CONFIG_FILE:-.git/push.config} ou défauts)"
    echo "  -a, --all               Pousse tous les changements (sous-modules + principal)"
    echo "  -m, --main              Pousse uniquement le projet principal"
    echo "  -s, --submodules        Pousse uniquement les sous-modules"
    echo "  -n, --no-confirm        Ne demande pas de confirmation"
    echo "  --submodule=NAME        Pousse uniquement le sous-module spécifié"
    echo "  --submodules=NAMES      Pousse les sous-modules spécifiés (séparés par des virgules)"
    echo "  --timeout=SECONDS       Délai d'attente pour les opérations Git (défaut: ${DEFAULT_TIMEOUT:-30})"
    echo "  --no-backup             Désactive la création de backup"
    echo "  --no-conflict-check     Désactive la vérification des conflits (défaut: ${CONFLICT_CHECK:-true})"
    echo "  --no-branch-check       Désactive la vérification des branches (défaut: ${BRANCH_CHECK:-true})"
    echo "  --no-remote-check       Désactive la vérification des remotes (défaut: ${REMOTE_CHECK:-true})"
    echo "  --backup-dir=DIR        Répertoire de backup (défaut: ${BACKUP_DIR:-.git/backups})"
    echo "  --max-backups=N         Nombre maximum de backups (défaut: ${MAX_BACKUPS:-5})"
    echo "  --branch=NAME           Spécifie la branche à pousser (défaut: ${DEFAULT_BRANCH:-master})"
    echo "  --remote=NAME           Spécifie le remote à utiliser (défaut: ${DEFAULT_REMOTE:-origin})"
    echo ""
    echo -e "${BLUE}Exemples:${NC}"
    echo "  $0 -d -a                # Pousse tout avec logs de debug"
    echo "  $0 -c my_config.cfg     # Utilise my_config.cfg"
    echo "  $0 -i                   # Configure interactivement"
    echo "  $0 -S                   # Affiche la configuration"
    echo "  $0 -a                   # Pousse tout avec confirmation"
    echo "  $0 -m -n                # Pousse le principal sans confirmation"
    echo "  $0 --submodule=module1  # Pousse uniquement module1"
    echo "  $0 --submodules=mod1,mod2 # Pousse mod1 et mod2"
    echo "  $0 --branch=develop     # Pousse sur la branche develop"
    echo "  $0 --remote=upstream    # Pousse vers le remote upstream"
}

# Fonction pour gérer les erreurs
handle_error() {
    local message=$1
    local code=${2:-1}
    log_error "$message" # Use log_error
    # Attempt to release lock before exiting
    release_lock
    exit $code
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_debug "Vérification des prérequis..."
    # Vérifier si Git est installé
    if ! command -v git &> /dev/null; then
        handle_error "Git n'est pas installé"
    fi
    log_debug "Git est installé."

    # Vérifier si on est dans un dépôt Git
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        handle_error "Ce répertoire n'est pas un dépôt Git valide"
    fi
    log_debug "Est dans un dépôt Git."

    # Vérifier si les sous-modules sont initialisés si .gitmodules existe
    if [ -f .gitmodules ]; then
         log_debug "Fichier .gitmodules trouvé. Vérification de l'initialisation des sous-modules..."
         # Use simpler check first
         if ! git submodule status > /dev/null 2>&1; then
            # Check specific error for non-initialized submodules more reliably
            if git submodule status 2>&1 | grep -q "not initialized"; then
                log_warn "Les sous-modules ne sont pas initialisés" # Keep warning visible
                read -p "Voulez-vous les initialiser ? (o/n) " -n 1 -r REPLY # Keep prompt visible
                echo
                if [[ $REPLY =~ ^[YyOo]$ ]]; then
                    log_info "${BLUE}🔄 Initialisation des sous-modules...${NC}" # Keep visible
                    if git submodule update --init --recursive; then
                         log_success "Sous-modules initialisés." # Keep visible
                    else
                         handle_error "Échec de l'initialisation des sous-modules"
                    fi
                fi
             else
                 log_warn "Impossible de vérifier le statut des sous-modules (erreur autre que non initialisé)."
             fi
         else
              log_debug "Sous-modules déjà initialisés ou statut OK."
         fi
    else
         log_debug "Aucun fichier .gitmodules trouvé."
    fi
    log_debug "Vérification des prérequis terminée."
}

# Fonction pour acquérir le verrou
acquire_lock() {
    log_debug "Tentative d'acquisition du verrou: $LOCK_FILE"
    # Check if lock file directory exists
     if [ ! -d "$(dirname "$LOCK_FILE")" ]; then
        handle_error "Le répertoire pour le fichier de verrouillage n'existe pas: $(dirname "$LOCK_FILE")"
    fi

    if [ -e "$LOCK_FILE" ]; then # Use -e to check for file existence reliably
        local pid=$(cat "$LOCK_FILE")
        # Check if pid is a number and if the process exists
        if [[ "$pid" =~ ^[0-9]+$ ]] && ps -p "$pid" > /dev/null; then
            handle_error "Une autre instance du script est en cours d'exécution (PID: $pid). Verrou: $LOCK_FILE"
        else
             log_warn "Ancien fichier de verrouillage trouvé ($LOCK_FILE), suppression..." # Keep warning visible
            if ! rm -f "$LOCK_FILE"; then
                # This is more serious, might indicate permissions issue
                 handle_error "Impossible de supprimer l'ancien fichier de verrouillage: $LOCK_FILE. Vérifiez les permissions."
            fi
        fi
    fi
    # Create lock file with current PID
    if echo $$ > "$LOCK_FILE"; then
         log_debug "Verrou acquis (PID: $$)."
    else
         handle_error "Impossible de créer le fichier de verrouillage: $LOCK_FILE"
    fi
}


# Fonction pour libérer le verrou
release_lock() {
    # Only remove the lock file if it exists and contains the current PID
    if [ -f "$LOCK_FILE" ] && [[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "$$" ]]; then
        log_debug "Libération du verrou: $LOCK_FILE"
        rm -f "$LOCK_FILE"
    elif [ -f "$LOCK_FILE" ]; then
         log_debug "Verrou non libéré (appartient à un autre PID ou erreur de lecture)."
    else
         log_debug "Aucun verrou à libérer."
    fi
}

# Fonction pour nettoyer en cas d'erreur ou d'exit
cleanup() {
    local exit_status=$?
    log_debug "Nettoyage... (Statut de sortie: $exit_status)"
    release_lock
    # Optional: Add any other cleanup tasks here
    log_debug "Nettoyage terminé."
    exit $exit_status # Exit with the original exit status
}

# Configuration du trap pour le nettoyage sur EXIT, INT, TERM
trap cleanup EXIT INT TERM

# Fonction pour afficher un résumé des changements (Keep visible for confirmation)
show_summary() {
    local context=$1 # e.g., "projet principal" or "sous-module X"
    local repo_path=$2 # "." or "path/to/submodule"

    local repo_display_name=$context # Use context for display name
    local original_dir=$(pwd)
    local resolved_path

    log_debug "Préparation du résumé pour '$repo_display_name' dans '$repo_path'..."
    resolved_path=$(normalize_path "$repo_path")
    if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        # This error is critical enough to remain visible
        log_error "Impossible d'accéder au répertoire '$repo_path' ('$resolved_path') pour '$repo_display_name'. Résumé ignoré."
        cd "$original_dir" # Attempt to go back
        return 1 # Indicate failure
    fi
    log_debug "Accès au répertoire '$resolved_path' réussi."


    # Use git status --porcelain for a quick check if anything needs summarizing
    if ! git status --porcelain | grep -q .; then
         log_success "Aucun changement détecté dans '$repo_display_name'." # Keep visible
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 0 # Indicate success (no changes)
    fi

    # This whole block remains visible as it's input for user confirmation
    log_info "\n${BLUE}📊 Résumé des changements dans '$repo_display_name' ($resolved_path):${NC}"

    local added=$(git diff --cached --name-only --diff-filter=A 2>/dev/null)
    local modified=$(git diff --cached --name-only --diff-filter=M 2>/dev/null)
    local deleted=$(git diff --cached --name-only --diff-filter=D 2>/dev/null)
    local untracked=$(git ls-files --others --exclude-standard)
    local staged_summary=$(git diff --cached --shortstat 2>/dev/null || echo "Aucun changement stagé")
    local unstaged_summary=$(git diff --shortstat 2>/dev/null || echo "Aucun changement non stagé")

    if [[ -n "$added" ]]; then
        log_info "${GREEN}  ➕ Stagéd Ajoutés :${NC}"
        printf "    - %s\n" $added
    fi
     if [[ -n "$modified" ]]; then
        log_info "${YELLOW}  ✏️ Stagéd Modifiés :${NC}"
        printf "    - %s\n" $modified
    fi
    if [[ -n "$deleted" ]]; then
        log_info "${RED}  ➖ Stagéd Supprimés :${NC}"
        printf "    - %s\n" $deleted
    fi
    log_info "${BLUE}  📊 Résumé Stagéd : $staged_summary${NC}"

    log_info "\n${BLUE}  📋 Changements Non Stagéd (seront inclus par 'git add .'):${NC}"
    local unstaged=$(git status --porcelain | grep '^ M\|^ D\|^ A') # Tracked files with unstaged changes
    if [[ -n "$untracked" ]]; then
        log_info "${YELLOW}    ❓ Fichiers Non Suivis:${NC}"
        printf "      - %s\n" $untracked
    fi
     if [[ -n "$unstaged" ]]; then
        log_info "${YELLOW}    ❗ Modifiés/Supprimés Non Stagéd:${NC}"
        printf "      - %s\n" $unstaged | sed 's/^ *//' # Basic formatting
    fi
     log_info "${BLUE}  📊 Résumé Non Stagéd : $unstaged_summary${NC}"

    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    log_debug "Résumé pour '$repo_display_name' terminé."
    return 0 # Indicate success
}


# Fonction pour demander confirmation (Keep visible)
ask_confirmation() {
    local context=$1
    if [[ "$NO_CONFIRM" == "true" ]]; then
        log_debug "Confirmation automatique (--no-confirm)."
        return 0 # Confirmation skipped
    fi

    # Loop until valid input (o/O/y/Y or n/N)
    while true; do
        # Prompt remains visible
        read -p "Valider le commit et push de '$context' ? (o/n) : " confirm
        if [[ "$confirm" =~ ^[oOyY]$ ]]; then
            log_debug "Confirmation reçue pour '$context'."
            return 0 # Confirmed
        elif [[ "$confirm" =~ ^[nN]$ ]]; then
             log_debug "Refus de confirmation pour '$context'."
            return 1 # Not confirmed
        else
            # Invalid input warning remains visible
            log_warn "Réponse invalide. Veuillez entrer 'o' pour oui ou 'n' pour non."
        fi
    done
}

# Fonction pour normaliser les chemins (simplifiée)
normalize_path() {
    local path_input=$1
    log_debug "Normalisation du chemin: '$path_input'"
    # Basic cleaning: remove leading/trailing whitespace
    path_input=$(echo "$path_input" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    if [[ "$path_input" == "." ]]; then
        log_debug "Chemin normalisé: '.'"
        echo "."
        return 0
    fi

    # Use realpath for robust absolute path resolution
    local resolved_path
    if resolved_path=$(realpath "$path_input" 2>/dev/null); then
         log_debug "Chemin normalisé (realpath): '$resolved_path'"
         echo "$resolved_path"
    else
        # Keep this warning visible as it might indicate an issue
        log_warn "Impossible de résoudre le chemin '$path_input' avec realpath. Utilisation du chemin tel quel."
        log_debug "Chemin normalisé (échec realpath): '$path_input'"
        echo "$path_input" # Return original path on failure
    fi
}


# Fonction pour créer un backup
create_backup() {
    local source_path=$1 # Path to the directory to backup
    local repo_name=$2   # Name for the backup file prefix (e.g., "principal" or submodule name)

    if [[ "$NO_BACKUP" == "true" ]] || [[ "$MAX_BACKUPS" -le 0 ]]; then
        log_info "${YELLOW}ℹ️  Création de backup désactivée pour '$repo_name'.${NC}" # Keep visible
        return 0
    fi
    log_debug "Début de la création du backup pour '$repo_name' depuis '$source_path'..."

    local resolved_source_path
    resolved_source_path=$(normalize_path "$source_path")
    if [[ -z "$resolved_source_path" ]] || [[ ! -d "$resolved_source_path" ]]; then
         # Error remains visible
         log_error "Chemin source invalide pour le backup: '$source_path' -> '$resolved_source_path'. Backup annulé."
         return 1
    fi

    local resolved_backup_dir
    resolved_backup_dir=$(normalize_path "$BACKUP_DIR")
     if [[ -z "$resolved_backup_dir" ]]; then
         # Error remains visible
         log_error "Chemin de backup invalide: '$BACKUP_DIR'. Backup annulé."
         return 1
    fi

    local target_backup_subdir="$resolved_backup_dir/$repo_name"
    log_debug "Création du répertoire de backup: '$target_backup_subdir'..."
    if ! mkdir -p "$target_backup_subdir"; then
         # Error remains visible
         log_error "Impossible de créer le répertoire de backup: '$target_backup_subdir'. Backup annulé."
         return 1;
    fi

    local timestamp=$(date +%Y%m%d_%H%M%S)
    local safe_repo_name=$(echo "$repo_name" | sed 's|/|_|g')
    local backup_filename="${safe_repo_name}_${timestamp}.tar.gz"
    local full_backup_path="$target_backup_subdir/$backup_filename"

    # Visible log for backup start
    log_info "${BLUE}📦 Création du backup de '$repo_name' vers '$full_backup_path'...${NC}"

    local tar_options=(-czf "$full_backup_path" --exclude=".git" --exclude="$BACKUP_DIR")
    if [[ "$BACKUP_DIR" != /* ]] && [[ "$resolved_source_path" != "$resolved_backup_dir"* ]]; then
         local relative_backup_exclude=$(realpath --relative-to="$resolved_source_path" "$resolved_backup_dir" 2>/dev/null)
         if [[ -n "$relative_backup_exclude" ]]; then
             log_debug "Exclusion relative du répertoire de backup: '$relative_backup_exclude'"
             tar_options+=("--exclude=$relative_backup_exclude")
         else
              log_debug "Impossible de déterminer l'exclusion relative pour le backup dir '$BACKUP_DIR'"
         fi
    fi
    log_debug "Options Tar: ${tar_options[*]}"


    if ! tar "${tar_options[@]}" -C "$resolved_source_path" . 2> /tmp/tar_error.log; then # Capture stderr
         # Warning remains visible
         log_warn "Impossible de créer le backup '$full_backup_path'. Vérifiez les permissions et l'espace disque. Continuation sans backup."
         log_debug "Erreur Tar (voir /tmp/tar_error.log): $(cat /tmp/tar_error.log)"
         rm -f "$full_backup_path" # Remove potentially incomplete file
         return 0 # Continue script execution
    fi
    rm -f /tmp/tar_error.log # Clean up log file on success

    # Make backup success message debug only
    log_debug "Backup créé avec succès: $full_backup_path"

    # Clean up old backups
    log_debug "Recherche des anciens backups (> $MAX_BACKUPS) dans '$target_backup_subdir' pour le pattern '${safe_repo_name}_*.tar.gz'..."
    local backup_files_to_delete=$(find "$target_backup_subdir" -maxdepth 1 -name "${safe_repo_name}_*.tar.gz" -type f -printf '%T@ %p\n' | sort -nr | tail -n +$(($MAX_BACKUPS + 1)) | cut -d' ' -f2-)

    if [[ -n "$backup_files_to_delete" ]]; then
        # Make cleanup start message debug only
        log_debug "Nettoyage des anciens backups..."
        echo "$backup_files_to_delete" | while IFS= read -r file_to_delete; do
             if [[ -n "$file_to_delete" ]]; then
                log_debug "  Suppression: $file_to_delete"
                if ! rm -f "$file_to_delete"; then
                    # Keep warning about failed deletion visible
                    log_warn "Impossible de supprimer l'ancien backup '$file_to_delete'"
                fi
            fi
        done
        log_debug "Nettoyage terminé."
    else
         log_debug "Aucun ancien backup à nettoyer."
    fi

    return 0
}


# Fonction pour vérifier les conflits
check_conflicts() {
    local repo_path=$1
    local repo_name=$2

    if [[ "$CONFLICT_CHECK" == "false" ]]; then
        log_info "${YELLOW}ℹ️  Vérification des conflits désactivée pour '$repo_name'.${NC}" # Keep visible
        return 0
    fi

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
    if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        # Error remains visible
        log_error "Impossible d'accéder à '$repo_path' ('$resolved_path') pour vérifier les conflits de '$repo_name'. Vérification ignorée."
        cd "$original_dir" # Attempt to go back
        return 1
    fi

    log_debug "Vérification des conflits dans '$repo_name' ($resolved_path)..."

    local conflicts=$(git status --porcelain | grep '^UU')

    if [[ -n "$conflicts" ]]; then
        # Critical error, remains visible
        log_error "Conflits détectés dans '$repo_name' :"
        printf "    %s\n" "$conflicts" # Print each conflict line
        cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
        handle_error "Résolvez les conflits dans '$repo_name' avant de pousser." # handle_error exits
    fi

    # Success message only in debug
    log_debug "Aucun conflit détecté dans '$repo_name'."
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}


# Fonction pour vérifier la branche
check_branch() {
    local repo_path=$1
    local repo_name=$2

    if [[ "$BRANCH_CHECK" == "false" ]] || [[ -z "$SPECIFIED_BRANCH" ]]; then
        if [[ "$BRANCH_CHECK" == "false" ]]; then
             log_info "${YELLOW}ℹ️  Vérification de la branche désactivée pour '$repo_name'.${NC}" # Keep visible
        else
             log_debug "Aucune branche spécifique demandée, vérification ignorée pour '$repo_name'."
        fi
        return 0
    fi

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
     if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        # Error remains visible
        log_error "Impossible d'accéder à '$repo_path' ('$resolved_path') pour vérifier la branche de '$repo_name'. Vérification ignorée."
         cd "$original_dir"
        return 1
    fi

    log_debug "Vérification de la branche dans '$repo_name' ($resolved_path) (doit être '$SPECIFIED_BRANCH')..."

    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [[ -z "$current_branch" ]]; then
         # Error remains visible
         log_error "Impossible de déterminer la branche actuelle dans '$repo_name'. Vérification ignorée."
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 1
    fi
    log_debug "Branche actuelle dans '$repo_name': '$current_branch'."

    if [[ "$current_branch" != "$SPECIFIED_BRANCH" ]]; then
         # Critical error, remains visible
         cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
         handle_error "La branche actuelle ('$current_branch') dans '$repo_name' n'est pas la branche spécifiée ('$SPECIFIED_BRANCH')."
    fi

    # Success message only in debug
    log_debug "Branche vérifiée dans '$repo_name' : '$current_branch'."
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}

# Fonction pour vérifier le remote
check_remote() {
    local repo_path=$1
    local repo_name=$2

    if [[ "$REMOTE_CHECK" == "false" ]] || [[ -z "$SPECIFIED_REMOTE" ]]; then
         if [[ "$REMOTE_CHECK" == "false" ]]; then
             log_info "${YELLOW}ℹ️  Vérification du remote désactivée pour '$repo_name'.${NC}" # Keep visible
         else
             log_debug "Aucun remote spécifique demandé, vérification ignorée pour '$repo_name'."
         fi
        return 0
    fi

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
     if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        # Error remains visible
        log_error "Impossible d'accéder à '$repo_path' ('$resolved_path') pour vérifier le remote de '$repo_name'. Vérification ignorée."
         cd "$original_dir"
        return 1
    fi

    log_debug "Vérification du remote dans '$repo_name' ($resolved_path) (doit être '$SPECIFIED_REMOTE')..."

    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
     if [[ -z "$current_branch" ]]; then
         # Error remains visible
         log_error "Impossible de déterminer la branche actuelle dans '$repo_name' pour vérifier le remote. Vérification ignorée."
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 1
    fi
     log_debug "Branche actuelle pour la vérification du remote: '$current_branch'."


    # Check if the specified remote exists
    log_debug "Vérification de l'existence du remote '$SPECIFIED_REMOTE'..."
    if ! git remote | grep -q "^${SPECIFIED_REMOTE}$"; then
         cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
         handle_error "Le remote spécifié '$SPECIFIED_REMOTE' n'existe pas dans '$repo_name'." # Critical error
    fi
     log_debug "Remote '$SPECIFIED_REMOTE' existe."


    # Check the remote configured for the current branch (if any)
    log_debug "Vérification du remote configuré pour la branche '$current_branch'..."
    local configured_remote
    configured_remote=$(git config branch.$current_branch.remote 2>/dev/null)

    if [[ -z "$configured_remote" ]]; then
         # Warning remains visible
         log_warn "Aucun remote configuré pour la branche '$current_branch' dans '$repo_name'. Push utilisera '$SPECIFIED_REMOTE'."
         # Decide if setting upstream automatically is desired (might be too intrusive)
         # log_debug "Configuration du remote '$SPECIFIED_REMOTE' pour la branche '$current_branch'..."
         # git branch --set-upstream-to="$SPECIFIED_REMOTE/$current_branch" "$current_branch" || { cd "$original_dir"; handle_error "Impossible de configurer le remote '$SPECIFIED_REMOTE' pour la branche '$current_branch' dans '$repo_name'"; }
    elif [[ "$configured_remote" != "$SPECIFIED_REMOTE" ]]; then
        # Critical error, remains visible
        cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
        handle_error "Le remote configuré ('$configured_remote') pour la branche '$current_branch' dans '$repo_name' n'est pas le remote spécifié ('$SPECIFIED_REMOTE')."
    else
         log_debug "Remote configuré ('$configured_remote') correspond au remote demandé ('$SPECIFIED_REMOTE')."
    fi

    # Success message only in debug
    log_debug "Remote vérifié dans '$repo_name' : '$SPECIFIED_REMOTE' sera utilisé pour le push."
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}


# Fonction pour commiter les changements
commit_changes() {
    local context=$1   # e.g., "(projet principal)" or "(sous-module X)"
    local repo_name=$2 # e.g., "principal" or "submodule_name"
    local repo_path=$3 # e.g., "." or "path/to/submodule"

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
     if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        # Error remains visible
        log_error "Impossible d'accéder à '$repo_path' ('$resolved_path') pour commiter les changements de '$repo_name'. Commit annulé."
         cd "$original_dir"
        return 1
    fi

    # Visible message for preparation start
    log_info "${BLUE}📝 Préparation du commit pour '$repo_name'...${NC}"

    log_debug "Ajout de tous les changements (git add .) dans '$resolved_path'..."
    if [[ -n "$TIMEOUT_CMD" ]]; then
        if ! $TIMEOUT_CMD "$TIMEOUT" git add . 2> /tmp/git_add_error.log; then
             log_debug "Erreur git add (voir /tmp/git_add_error.log): $(cat /tmp/git_add_error.log)"
             rm -f /tmp/git_add_error.log
             cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
             handle_error "Timeout ou erreur lors de l'ajout des fichiers pour '$repo_name'"
        fi
    else
        if ! git add . 2> /tmp/git_add_error.log; then
             log_debug "Erreur git add (voir /tmp/git_add_error.log): $(cat /tmp/git_add_error.log)"
             rm -f /tmp/git_add_error.log
             cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
             handle_error "Échec de l'ajout des fichiers (git add .) pour '$repo_name'"
        fi
    fi
     rm -f /tmp/git_add_error.log # Clean up log file on success
     log_debug "Ajout des fichiers terminé."


     # Check if there are any changes staged for commit
     log_debug "Vérification des changements stagés..."
    if ! git diff --cached --quiet --exit-code; then
        log_debug "Changements stagés détectés. Génération du message de commit..."
        local commit_msg="MAJ auto $context $(date +%Y-%m-%d_%H:%M:%S)"
        local staged_summary
        staged_summary=$(git diff --cached --shortstat)
        commit_msg+="\n\nRésumé des changements stagés:\n$staged_summary"
        log_debug "Message de commit généré:\n---\n$commit_msg\n---"


        log_debug "Commit des changements stagés..."
        if [[ -n "$TIMEOUT_CMD" ]]; then
            if ! echo -e "$commit_msg" | $TIMEOUT_CMD "$TIMEOUT" git commit --file=- 2> /tmp/git_commit_error.log; then
                 log_debug "Erreur git commit (voir /tmp/git_commit_error.log): $(cat /tmp/git_commit_error.log)"
                 rm -f /tmp/git_commit_error.log
                 cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
                 handle_error "Timeout ou erreur lors du commit pour '$repo_name'"
            fi
        else
             if ! echo -e "$commit_msg" | git commit --file=- 2> /tmp/git_commit_error.log; then
                 log_debug "Erreur git commit (voir /tmp/git_commit_error.log): $(cat /tmp/git_commit_error.log)"
                 rm -f /tmp/git_commit_error.log
                 cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
                 handle_error "Échec du commit pour '$repo_name'"
            fi
        fi
         rm -f /tmp/git_commit_error.log # Clean up on success
         log_success "Commit effectué dans '$repo_name'." # Keep success visible
    else
        # Keep visible if nothing to commit
        log_success "Aucun changement stagé à commiter dans '$repo_name'."
    fi


    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}

# --- Script Main Logic ---

# Variables par défaut (load_config will override if file exists)
PUSH_ALL=false
PUSH_MAIN=false
PUSH_SUBMODULES=false
NO_CONFIRM=false
NO_BACKUP=false
# CONFLICT_CHECK, BRANCH_CHECK, REMOTE_CHECK set by load_config or defaults at top
SPECIFIC_SUBMODULES=()
SPECIFIC_SUBMODULE=""
SPECIFIED_BRANCH=""
SPECIFIED_REMOTE=""
TIMEOUT=$DEFAULT_TIMEOUT
# CONFIG_FILE, DEBUG_MODE set at top or by args

# Traitement des arguments
# Use getopt for more robust parsing
TEMP=$(getopt -o hc:iSa:msnd --long help,config:,interactive,show-config,all,main,submodules,no-confirm,submodule:,submodules:,timeout:,no-backup,no-conflict-check,no-branch-check,no-remote-check,backup-dir:,max-backups:,branch:,remote:,debug -n "$0" -- "$@")

if [ $? != 0 ] ; then log_error "Erreur lors de l'analyse des options." >&2 ; show_help; exit 1 ; fi

eval set -- "$TEMP" # Note quotes are essential!

# Reset argument-related variables
CONFIG_FILE_ARG=""
INTERACTIVE_MODE=false
SHOW_CONFIG_MODE=false
PUSH_ALL=false
PUSH_MAIN=false
PUSH_SUBMODULES=false
NO_CONFIRM=false
SPECIFIC_SUBMODULE=""
SPECIFIC_SUBMODULES=()
TIMEOUT_ARG=""
NO_BACKUP_ARG=false # Use different var names to distinguish from config values
NO_CONFLICT_CHECK_ARG=false
NO_BRANCH_CHECK_ARG=false
NO_REMOTE_CHECK_ARG=false
BACKUP_DIR_ARG=""
MAX_BACKUPS_ARG=""
SPECIFIED_BRANCH_ARG=""
SPECIFIED_REMOTE_ARG=""
DEBUG_MODE_ARG=false # For command line flag


while true; do
  case "$1" in
    -h | --help ) show_help; exit 0 ;;
    -d | --debug ) DEBUG_MODE_ARG=true; shift ;; # Added debug flag
    -c | --config ) CONFIG_FILE_ARG="$2"; shift 2 ;;
    -i | --interactive ) INTERACTIVE_MODE=true; shift ;;
    -S | --show-config ) SHOW_CONFIG_MODE=true; shift ;;
    -a | --all ) PUSH_ALL=true; shift ;;
    -m | --main ) PUSH_MAIN=true; shift ;;
    -s | --submodules ) PUSH_SUBMODULES=true; shift ;;
    -n | --no-confirm ) NO_CONFIRM=true; shift ;;
    --submodule ) SPECIFIC_SUBMODULE="$2"; shift 2 ;;
    --submodules ) IFS=',' read -ra SPECIFIC_SUBMODULES <<< "$2"; shift 2 ;;
    --timeout ) TIMEOUT_ARG="$2"; shift 2 ;;
    --no-backup ) NO_BACKUP_ARG=true; shift ;;
    --no-conflict-check ) NO_CONFLICT_CHECK_ARG=true; shift ;;
    --no-branch-check ) NO_BRANCH_CHECK_ARG=true; shift ;;
    --no-remote-check ) NO_REMOTE_CHECK_ARG=true; shift ;;
    --backup-dir ) BACKUP_DIR_ARG="$2"; shift 2 ;;
    --max-backups ) MAX_BACKUPS_ARG="$2"; shift 2 ;;
    --branch ) SPECIFIED_BRANCH_ARG="$2"; shift 2 ;;
    --remote ) SPECIFIED_REMOTE_ARG="$2"; shift 2 ;;
    -- ) shift; break ;;
    * ) handle_error "Erreur interne de parsing d'arguments!" ;; # Use handle_error
  esac
done

# --- Configuration Loading and Prioritization ---

# 0. Set Debug Mode if specified by arg (overrides default)
if [[ "$DEBUG_MODE_ARG" == "true" ]]; then DEBUG_MODE=true; fi
log_debug "Mode Debug activé par argument."

# 1. Set config file path if provided via arg (overrides default)
if [[ -n "$CONFIG_FILE_ARG" ]]; then
    log_debug "Utilisation du fichier de configuration spécifié par argument: '$CONFIG_FILE_ARG'"
    CONFIG_FILE="$CONFIG_FILE_ARG"
fi

# 2. Load config from file (overrides defaults, potentially sets DEBUG_MODE)
load_config "$CONFIG_FILE"
# Re-check debug mode in case it was set in the config file
if [[ "$DEBUG_MODE_ARG" == "true" ]]; then DEBUG_MODE=true; fi
log_debug "État Debug Mode après chargement config: $DEBUG_MODE"


# 3. Handle interactive mode (must happen after loading potential config)
if [[ "$INTERACTIVE_MODE" == "true" ]]; then
    configure_interactive # This loads, prompts, updates, saves config, and sets runtime vars
    log_debug "Configuration interactive terminée. Sortie."
    exit 0
fi

# 4. Handle show config mode
if [[ "$SHOW_CONFIG_MODE" == "true" ]]; then
    show_config # Loads and shows current config (including debug status)
    log_debug "Affichage de la configuration terminé. Sortie."
    exit 0
fi

# 5. Apply command-line behaviour flags, overriding config file values
# Note: NO_BACKUP is handled differently (it's a direct flag, not config override)
if [[ "$NO_CONFLICT_CHECK_ARG" == "true" ]]; then CONFLICT_CHECK=false; log_debug "Vérification des conflits désactivée par argument."; fi
if [[ "$NO_BRANCH_CHECK_ARG" == "true" ]]; then BRANCH_CHECK=false; log_debug "Vérification des branches désactivée par argument."; fi
if [[ "$NO_REMOTE_CHECK_ARG" == "true" ]]; then REMOTE_CHECK=false; log_debug "Vérification des remotes désactivée par argument."; fi
if [[ "$NO_BACKUP_ARG" == "true" ]]; then NO_BACKUP=true; log_debug "Backups désactivés par argument."; fi

# 6. Apply command-line value overrides
if [[ -n "$BACKUP_DIR_ARG" ]]; then BACKUP_DIR="$BACKUP_DIR_ARG"; log_debug "Répertoire de backup défini par argument: $BACKUP_DIR"; fi
if [[ -n "$MAX_BACKUPS_ARG" ]]; then
     if ! [[ "$MAX_BACKUPS_ARG" =~ ^[0-9]+$ ]]; then handle_error "Le nombre de backups (--max-backups) doit être un nombre entier"; fi
     MAX_BACKUPS="$MAX_BACKUPS_ARG"; log_debug "Max backups défini par argument: $MAX_BACKUPS"
fi
if [[ -n "$SPECIFIED_BRANCH_ARG" ]]; then SPECIFIED_BRANCH="$SPECIFIED_BRANCH_ARG"; log_debug "Branche spécifiée par argument: $SPECIFIED_BRANCH"; fi
if [[ -n "$SPECIFIED_REMOTE_ARG" ]]; then SPECIFIED_REMOTE="$SPECIFIED_REMOTE_ARG"; log_debug "Remote spécifié par argument: $SPECIFIED_REMOTE"; fi
if [[ -n "$TIMEOUT_ARG" ]]; then
     if ! [[ "$TIMEOUT_ARG" =~ ^[0-9]+$ ]]; then handle_error "Le timeout (--timeout) doit être un nombre entier"; fi
     TIMEOUT="$TIMEOUT_ARG"; log_debug "Timeout défini par argument: $TIMEOUT"
fi

# 7. Set default branch/remote if still empty after config and args
# These were loaded or initialized in load_config/interactive, ensure they have fallback
DEFAULT_BRANCH=${DEFAULT_BRANCH:-master}
DEFAULT_REMOTE=${DEFAULT_REMOTE:-origin}
# Use default branch/remote if specific ones weren't provided by args
SPECIFIED_BRANCH=${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}
SPECIFIED_REMOTE=${SPECIFIED_REMOTE:-$DEFAULT_REMOTE}
log_debug "Branche effective pour push: $SPECIFIED_BRANCH"
log_debug "Remote effectif pour push: $SPECIFIED_REMOTE"


# --- Execution Logic ---

# Check prerequisites before locking
check_prerequisites

# Acquire lock
acquire_lock # Trap will handle release


# Determine default action if none specified
if [[ "$PUSH_ALL" == "false" && "$PUSH_MAIN" == "false" && "$PUSH_SUBMODULES" == "false" && -z "$SPECIFIC_SUBMODULE" && ${#SPECIFIC_SUBMODULES[@]} -eq 0 ]]; then
    log_info "${YELLOW}ℹ️  Aucune action spécifiée (-a, -m, -s, --submodule), utilisation de --all par défaut.${NC}" # Keep visible
    PUSH_ALL=true
fi

# --- Submodule Processing ---

process_submodule() {
    local name=$1
    local path=$2

    local resolved_path
    resolved_path=$(normalize_path "$path")
    if [[ -z "$resolved_path" ]] || [[ ! -d "$resolved_path" ]]; then
         # Error remains visible
         log_error "Chemin invalide ou inaccessible pour le sous-module '$name': '$path' -> '$resolved_path'. Ignoré."
         return 1
    fi

    # Header only in debug
    log_debug "\n=== Début Traitement Sous-module : '$name' ($resolved_path) ==="

    local original_dir=$(pwd)
    if ! cd "$resolved_path" 2>/dev/null; then
        # Error remains visible
        log_error "Impossible d'accéder au répertoire du sous-module '$name' ($resolved_path). Ignoré."
        cd "$original_dir" # Attempt to go back
        return 1
    fi
    log_debug "Accès au répertoire du sous-module '$resolved_path' réussi."


    # Run checks (internal logging controlled by DEBUG_MODE)
    if ! check_conflicts "$resolved_path" "$name"; then cd "$original_dir"; return 1; fi
    if ! check_branch "$resolved_path" "$name"; then cd "$original_dir"; return 1; fi
    if ! check_remote "$resolved_path" "$name"; then cd "$original_dir"; return 1; fi

    # Check for changes again after checks
    if ! git status --porcelain | grep -q .; then
         # Visible message if no changes
         log_success "Aucun changement détecté dans '$name' après vérifications."
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         log_debug "=== Fin Traitement Sous-module (aucun changement) : '$name' ==="
         return 0
    fi


    # Show summary (visible)
    show_summary "$name" "$resolved_path"

    # Ask for confirmation (visible prompt)
    if ! ask_confirmation "$name"; then
        # Visible message if skipped
        log_info "${YELLOW}⏭️  Commit et Push du sous-module '$name' annulés par l'utilisateur.${NC}"
        cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
        log_debug "=== Fin Traitement Sous-module (annulé par utilisateur) : '$name' ==="
        return 0
    fi

    # Create backup (internal logging controlled by DEBUG_MODE)
    create_backup "$resolved_path" "$name"

    # Commit changes (internal logging controlled by DEBUG_MODE, success/fail visible)
    if ! commit_changes "(sous-module $name)" "$name" "$resolved_path"; then
         # Error message already logged by commit_changes or handle_error
         cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
         log_debug "=== Fin Traitement Sous-module (erreur commit) : '$name' ==="
         return 1
    fi


    # Determine branch and remote for push (already determined globally)
    local push_branch=$SPECIFIED_BRANCH
    local push_remote=$SPECIFIED_REMOTE

    # Visible message for push start
    log_info "${GREEN}🚀 Push '$name' ($push_branch) → '$push_remote'...${NC}"

    # Push (errors are handled)
    local push_cmd=(git push "$push_remote" "$push_branch")
    log_debug "Exécution push: ${push_cmd[*]}"
    local push_output=""
    local push_error=""
    local push_status=0

    if [[ -n "$TIMEOUT_CMD" ]]; then
         # Capture stdout and stderr separately for debug
         push_error=$( { push_output=$($TIMEOUT_CMD "$TIMEOUT" "${push_cmd[@]}" 2>&1 >&3 3>&-); } 3>&1 ) || push_status=$?
    else
         push_error=$( { push_output=$("${push_cmd[@]}" 2>&1 >&3 3>&-); } 3>&1 ) || push_status=$?
    fi
    # 3>&1 redirects original stdout to fd 3
    # 2>&1 redirects stderr to where stdout *currently* points (original stdout via fd 3)
    # >&3 redirects stdout (which now receives stderr) to where fd 3 points (original stdout)

    if [[ $push_status -ne 0 ]]; then
        log_debug "--- Sortie Push (stdout) '$name' --- \n$push_output\n--- Fin Sortie Push ---"
        log_debug "--- Erreur Push (stderr) '$name' --- \n$push_error\n--- Fin Erreur Push ---"
        cd "$original_dir" || log_warn "Impossible de revenir au répertoire original depuis $resolved_path"
        handle_error "Timeout ($TIMEOUT s) ou erreur ($push_status) lors du push de '$name' vers '$push_remote/$push_branch'." # Critical error
    fi
     log_debug "--- Sortie Push (stdout) '$name' --- \n$push_output\n--- Fin Sortie Push ---"
     log_debug "--- Erreur Push (stderr) '$name' --- \n$push_error\n--- Fin Erreur Push ---"

    # Visible success message
    log_success "Push de '$name' terminé."
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    log_debug "=== Fin Traitement Sous-module (succès) : '$name' ==="
    return 0 # Success
}


# --- Main Processing Logic ---

# Process Submodules if requested
if [[ "$PUSH_ALL" == "true" || "$PUSH_SUBMODULES" == "true" || -n "$SPECIFIC_SUBMODULE" || ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
    # Header only in debug
    log_debug "\n=== Début Traitement des Sous-modules ==="

    # Get list of submodules reliably
    log_debug "Récupération de la liste des sous-modules..."
    submodule_list=$(git submodule status --recursive | awk '{print $2}') # Get paths reliably

    if [[ -z "$submodule_list" ]]; then
         # Visible info if no submodules
         log_info "${YELLOW}ℹ️  Aucun sous-module trouvé ou enregistré dans ce dépôt.${NC}"
    else
        log_debug "Liste des chemins de sous-modules trouvés:\n$submodule_list"
        processed_any_submodule=false
        # Iterate over submodule paths
        echo "$submodule_list" | while IFS= read -r sub_path; do
            # Get submodule name from path (usually the same, but path is key)
            # Use dirname/basename or parameter expansion for robustness if paths can have spaces?
            # Assuming simple paths for now.
            sub_name=$(basename "$sub_path")

            # Trim leading/trailing whitespace just in case
            sub_path=$(echo "$sub_path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            sub_name=$(echo "$sub_name" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            log_debug "Analyse du sous-module: Nom='$sub_name', Chemin='$sub_path'"

             # Check if this submodule should be processed
            process_this=false
            if [[ "$PUSH_ALL" == "true" ]] || [[ "$PUSH_SUBMODULES" == "true" ]]; then
                process_this=true
                log_debug "Traitement de '$sub_name' (cause: --all ou --submodules)."
            elif [[ -n "$SPECIFIC_SUBMODULE" && ( "$sub_name" == "$SPECIFIC_SUBMODULE" || "$sub_path" == "$SPECIFIC_SUBMODULE" ) ]]; then
                 process_this=true
                 log_debug "Traitement de '$sub_name' (cause: --submodule correspond)."
            elif [[ ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
                 for requested_sub in "${SPECIFIC_SUBMODULES[@]}"; do
                     if [[ "$sub_name" == "$requested_sub" ]] || [[ "$sub_path" == "$requested_sub" ]]; then
                         process_this=true
                         log_debug "Traitement de '$sub_name' (cause: --submodules correspond)."
                         break
                     fi
                 done
            fi

            if [[ "$process_this" == "true" ]]; then
                processed_any_submodule=true
                process_submodule "$sub_name" "$sub_path"
                # Errors inside process_submodule are fatal via handle_error
            else
                 log_debug "Ignoré: '$sub_name' ne correspond pas aux critères."
            fi
        done # End while loop for submodules

        if [[ "$processed_any_submodule" == "false" ]]; then
            # Visible info if no matches
            log_info "${YELLOW}ℹ️  Aucun sous-module ne correspond aux critères spécifiés. (${SPECIFIC_SUBMODULE:-}${SPECIFIC_SUBMODULES[*]:+ , ${SPECIFIC_SUBMODULES[*]}})${NC}"
        fi
    fi # End check for empty submodule list
     log_debug "=== Fin Traitement des Sous-modules ==="
fi


# Process Main Project if requested
if [[ "$PUSH_ALL" == "true" || "$PUSH_MAIN" == "true" ]]; then
    # Header only in debug
    log_debug "\n=== Début Traitement du Projet Principal (.) ==="

     # Run checks (internal logging controlled by DEBUG_MODE)
    if ! check_conflicts "." "projet principal"; then exit 1; fi
    if ! check_branch "." "projet principal"; then exit 1; fi
    if ! check_remote "." "projet principal"; then exit 1; fi

    # Check for changes in main repo
    if ! git status --porcelain | grep -q .; then
         # Visible message if no changes
         log_success "Aucun changement détecté dans le projet principal après vérifications."
    else
         # Show summary (visible)
        show_summary "projet principal" "."

        # Ask for confirmation (visible prompt)
        if ! ask_confirmation "projet principal"; then
            # Visible message if skipped
            log_info "${YELLOW}⏭️  Commit et Push du projet principal annulés par l'utilisateur.${NC}"
        else
             # Create backup (internal logging)
            create_backup "." "principal"

            # Commit changes (internal logging, success/fail visible)
            if ! commit_changes "(projet principal)" "principal" "."; then
                 # Error message logged by commit_changes/handle_error
                 log_debug "=== Fin Traitement Projet Principal (erreur commit) ==="
                 exit 1
            fi

             # Determine branch and remote for push (already determined globally)
            push_branch=$SPECIFIED_BRANCH
            push_remote=$SPECIFIED_REMOTE

            # Visible message for push start
            log_info "${GREEN}🚀 Push projet principal ($push_branch) → '$push_remote'...${NC}"

            # Push (errors are handled)
            push_cmd=(git push "$push_remote" "$push_branch")
            log_debug "Exécution push: ${push_cmd[*]}"
            push_output=""
            push_error=""
            push_status=0

            if [[ -n "$TIMEOUT_CMD" ]]; then
                push_error=$( { push_output=$($TIMEOUT_CMD "$TIMEOUT" "${push_cmd[@]}" 2>&1 >&3 3>&-); } 3>&1 ) || push_status=$?
            else
                push_error=$( { push_output=$("${push_cmd[@]}" 2>&1 >&3 3>&-); } 3>&1 ) || push_status=$?
            fi

             if [[ $push_status -ne 0 ]]; then
                log_debug "--- Sortie Push (stdout) principal --- \n$push_output\n--- Fin Sortie Push ---"
                log_debug "--- Erreur Push (stderr) principal --- \n$push_error\n--- Fin Erreur Push ---"
                handle_error "Timeout ($TIMEOUT s) ou erreur ($push_status) lors du push du projet principal vers '$push_remote/$push_branch'."
             fi
             log_debug "--- Sortie Push (stdout) principal --- \n$push_output\n--- Fin Sortie Push ---"
             log_debug "--- Erreur Push (stderr) principal --- \n$push_error\n--- Fin Erreur Push ---"


             # Visible success message
             log_success "Push du projet principal terminé."
        fi # End confirmation check
    fi # End changes check
     log_debug "=== Fin Traitement Projet Principal ==="
fi # End main project processing


# Final success message (always visible)
log_success "Opération terminée."
exit 0