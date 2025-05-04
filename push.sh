#!/bin/bash

set -euo pipefail

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
MAX_DIFF_LINES=10
DEFAULT_TIMEOUT=30
LOCK_FILE="/tmp/push.lock"
BACKUP_DIR=".git/backups"
MAX_BACKUPS=5
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
# Removed AUTO_STASH=true
CONFIG_FILE=".git/push.config"

# Vérification de la commande timeout
if ! command -v timeout &> /dev/null; then
    echo -e "${YELLOW}⚠️  La commande 'timeout' n'est pas disponible, désactivation des timeouts${NC}"
    TIMEOUT_CMD=""
else
    TIMEOUT_CMD="timeout"
fi

# Fonction pour charger la configuration
load_config() {
    local config_file=$1
    if [ -f "$config_file" ]; then
        source "$config_file"
        # Initialiser les variables actuelles à partir des valeurs par défaut
        # Make sure defaults are loaded correctly even if not present in file
        BACKUP_DIR=${DEFAULT_BACKUP_DIR:-.git/backups}
        MAX_BACKUPS=${DEFAULT_MAX_BACKUPS:-5}
        CONFLICT_CHECK=${DEFAULT_CONFLICT_CHECK:-true}
        BRANCH_CHECK=${DEFAULT_BRANCH_CHECK:-true}
        REMOTE_CHECK=${DEFAULT_REMOTE_CHECK:-true}
        # Removed AUTO_STASH related line
    fi
}

# Fonction pour sauvegarder la configuration
save_config() {
    local config_file=$1
    cat > "$config_file" << EOF
# Configuration sauvegardée le $(date)
DEFAULT_BRANCH="$DEFAULT_BRANCH"
DEFAULT_REMOTE="$DEFAULT_REMOTE"
DEFAULT_BACKUP_DIR="$BACKUP_DIR"
DEFAULT_MAX_BACKUPS="$MAX_BACKUPS"
DEFAULT_CONFLICT_CHECK="$CONFLICT_CHECK"
DEFAULT_BRANCH_CHECK="$BRANCH_CHECK"
DEFAULT_REMOTE_CHECK="$REMOTE_CHECK"
# Removed DEFAULT_AUTO_STASH line
EOF
    echo -e "${GREEN}✅ Configuration sauvegardée dans $config_file${NC}"
}

# Fonction pour configurer interactivement
configure_interactive() {
    echo -e "${BLUE}📝 Configuration interactive${NC}"

    # Demander le fichier de configuration
    read -p "Fichier de configuration [${CONFIG_FILE:-.git/push.config}] : " input_config_file
    CONFIG_FILE=${input_config_file:-${CONFIG_FILE:-.git/push.config}}

    # Initialiser les valeurs par défaut au cas où le fichier n'existe pas ou est incomplet
    DEFAULT_BRANCH="master"
    DEFAULT_REMOTE="origin"
    DEFAULT_BACKUP_DIR=".git/backups"
    DEFAULT_MAX_BACKUPS="5"
    DEFAULT_CONFLICT_CHECK="true" # Use true/false directly
    DEFAULT_BRANCH_CHECK="true"
    DEFAULT_REMOTE_CHECK="true"
    # Removed DEFAULT_AUTO_STASH

    # Charger la configuration existante si elle existe, surcharge les défauts
    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${GREEN}✅ Chargement de la configuration existante...${NC}"
        # Use "." instead of source to avoid issues in some shells/modes
        . "$CONFIG_FILE"
    else
        echo -e "${YELLOW}⚠️  Création d'une nouvelle configuration...${NC}"
    fi

    # Convertir les valeurs booléennes en o/n pour l'affichage/prompt
    local conflict_check_prompt=$( [[ "$DEFAULT_CONFLICT_CHECK" == "true" ]] && echo "o" || echo "n" )
    local branch_check_prompt=$( [[ "$DEFAULT_BRANCH_CHECK" == "true" ]] && echo "o" || echo "n" )
    local remote_check_prompt=$( [[ "$DEFAULT_REMOTE_CHECK" == "true" ]] && echo "o" || echo "n" )
    # Removed auto_stash_prompt

    # Branche par défaut
    read -p "Branche par défaut [${DEFAULT_BRANCH}] : " input
    DEFAULT_BRANCH=${input:-$DEFAULT_BRANCH}

    # Remote par défaut
    read -p "Remote par défaut [${DEFAULT_REMOTE}] : " input
    DEFAULT_REMOTE=${input:-$DEFAULT_REMOTE}

    # Répertoire de backup
    read -p "Répertoire de backup [${DEFAULT_BACKUP_DIR}] : " input
    DEFAULT_BACKUP_DIR=${input:-$DEFAULT_BACKUP_DIR}

    # Nombre maximum de backups
    read -p "Nombre maximum de backups [${DEFAULT_MAX_BACKUPS}] : " input
    input_max_backups=${input:-$DEFAULT_MAX_BACKUPS}
    if ! [[ "$input_max_backups" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ Le nombre de backups doit être un nombre entier, utilisation de $DEFAULT_MAX_BACKUPS ${NC}"
        DEFAULT_MAX_BACKUPS=$DEFAULT_MAX_BACKUPS # Keep original default if invalid
    else
         DEFAULT_MAX_BACKUPS=$input_max_backups
    fi

    # Vérification des conflits
    read -p "Vérifier les conflits ? (o/n) [${conflict_check_prompt}] : " input
    input=${input:-${conflict_check_prompt}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_CONFLICT_CHECK="true" || DEFAULT_CONFLICT_CHECK="false"

    # Vérification des branches
    read -p "Vérifier les branches ? (o/n) [${branch_check_prompt}] : " input
    input=${input:-${branch_check_prompt}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_BRANCH_CHECK="true" || DEFAULT_BRANCH_CHECK="false"

    # Vérification des remotes
    read -p "Vérifier les remotes ? (o/n) [${remote_check_prompt}] : " input
    input=${input:-${remote_check_prompt}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_REMOTE_CHECK="true" || DEFAULT_REMOTE_CHECK="false"

    # Removed Auto Stash prompt

    # Mettre à jour les variables actuelles (pas seulement DEFAULT_*)
    BACKUP_DIR=$DEFAULT_BACKUP_DIR
    MAX_BACKUPS=$DEFAULT_MAX_BACKUPS
    CONFLICT_CHECK=$DEFAULT_CONFLICT_CHECK
    BRANCH_CHECK=$DEFAULT_BRANCH_CHECK
    REMOTE_CHECK=$DEFAULT_REMOTE_CHECK
    # Removed AUTO_STASH update

    # Sauvegarde de la configuration
    save_config "$CONFIG_FILE"
}

# Fonction pour afficher la configuration actuelle
show_config() {
    # Ensure config is loaded before showing
    load_config "$CONFIG_FILE"
    echo -e "${BLUE}📋 Configuration actuelle :${NC}"
    echo "Fichier de configuration : ${CONFIG_FILE:-Non défini}"
    echo "Branche par défaut : ${DEFAULT_BRANCH:-master}"
    echo "Remote par défaut : ${DEFAULT_REMOTE:-origin}"
    echo "Répertoire de backup : ${BACKUP_DIR:-.git/backups}"
    echo "Nombre maximum de backups : ${MAX_BACKUPS:-5}"
    echo "Vérification des conflits : ${CONFLICT_CHECK:-true}"
    echo "Vérification des branches : ${BRANCH_CHECK:-true}"
    echo "Vérification des remotes : ${REMOTE_CHECK:-true}"
    # Removed AUTO_STASH display
}


# Fonction pour afficher l'aide
show_help() {
    # Ensure config is loaded to show correct defaults in help
    load_config "$CONFIG_FILE"
    echo -e "${BLUE}Usage: $0 [options]${NC}"
    echo -e "${BLUE}Options:${NC}"
    echo "  -h, --help              Affiche cette aide"
    echo "  -c, --config=FILE       Utilise le fichier de configuration spécifié (défaut: ${CONFIG_FILE:-.git/push.config})"
    echo "  -i, --interactive       Configure ou modifie le fichier de configuration"
    echo "  -S, --show-config       Affiche la configuration actuelle (depuis ${CONFIG_FILE:-.git/push.config} ou défauts)" # Changed -s to -S to avoid conflict
    echo "  -a, --all               Pousse tous les changements (sous-modules + principal)"
    echo "  -m, --main              Pousse uniquement le projet principal"
    # -s was reused, maybe change this one? Let's keep it for now.
    echo "  -s, --submodules        Pousse uniquement les sous-modules"
    echo "  -n, --no-confirm        Ne demande pas de confirmation"
    echo "  --submodule=NAME        Pousse uniquement le sous-module spécifié"
    echo "  --submodules=NAMES      Pousse les sous-modules spécifiés (séparés par des virgules)"
    echo "  --timeout=SECONDS       Délai d'attente pour les opérations Git (défaut: ${DEFAULT_TIMEOUT:-30})"
    echo "  --no-backup             Désactive la création de backup"
    echo "  --no-conflict-check     Désactive la vérification des conflits (défaut: ${CONFLICT_CHECK:-true})"
    echo "  --no-branch-check       Désactive la vérification des branches (défaut: ${BRANCH_CHECK:-true})"
    echo "  --no-remote-check       Désactive la vérification des remotes (défaut: ${REMOTE_CHECK:-true})"
    # Removed --no-auto-stash help
    echo "  --backup-dir=DIR        Répertoire de backup (défaut: ${BACKUP_DIR:-.git/backups})"
    echo "  --max-backups=N         Nombre maximum de backups (défaut: ${MAX_BACKUPS:-5})"
    echo "  --branch=NAME           Spécifie la branche à pousser (défaut: ${DEFAULT_BRANCH:-master})"
    echo "  --remote=NAME           Spécifie le remote à utiliser (défaut: ${DEFAULT_REMOTE:-origin})"
    echo ""
    echo -e "${BLUE}Exemples:${NC}"
    echo "  $0 -c my_config.cfg     # Utilise my_config.cfg"
    echo "  $0 -i                   # Configure interactivement"
    echo "  $0 -S                   # Affiche la configuration"
    echo "  $0 -a                   # Pousse tout avec confirmation"
    echo "  $0 -m -n                # Pousse le principal sans confirmation"
    echo "  $0 --submodule=module1  # Pousse uniquement module1"
    echo "  $0 --submodules=mod1,mod2 # Pousse mod1 et mod2"
    echo "  $0 --branch=develop     # Pousse sur la branche develop"
    echo "  $0 --remote=upstream    # Pousse vers le remote upstream" # Example uses origin, changed for clarity
}

# Fonction pour gérer les erreurs
handle_error() {
    local message=$1
    local code=${2:-1}
    echo -e "${RED}❌ Erreur: $message${NC}" >&2
    # Attempt to release lock before exiting
    release_lock
    exit $code
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    # Vérifier si Git est installé
    if ! command -v git &> /dev/null; then
        handle_error "Git n'est pas installé"
    fi

    # Vérifier si on est dans un dépôt Git
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        handle_error "Ce répertoire n'est pas un dépôt Git valide"
    fi

    # Vérifier si les sous-modules sont initialisés si .gitmodules existe
    if [ -f .gitmodules ] && ! git submodule status > /dev/null 2>&1; then
        # Check specific error for non-initialized submodules more reliably
        if git submodule status 2>&1 | grep -q "not initialized"; then
            echo -e "${YELLOW}⚠️  Les sous-modules ne sont pas initialisés${NC}"
            read -p "Voulez-vous les initialiser ? (o/n) " -n 1 -r REPLY
            echo
            if [[ $REPLY =~ ^[YyOo]$ ]]; then
                echo -e "${BLUE}🔄 Initialisation des sous-modules...${NC}"
                git submodule update --init --recursive || handle_error "Échec de l'initialisation des sous-modules"
                echo -e "${GREEN}✅ Sous-modules initialisés.${NC}"
            fi
        fi
    fi
}

# Fonction pour acquérir le verrou
acquire_lock() {
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
             echo -e "${YELLOW}⚠️  Ancien fichier de verrouillage trouvé ($LOCK_FILE), suppression...${NC}"
            rm -f "$LOCK_FILE" || handle_error "Impossible de supprimer l'ancien fichier de verrouillage: $LOCK_FILE"
        fi
    fi
    # Create lock file with current PID
    echo $$ > "$LOCK_FILE" || handle_error "Impossible de créer le fichier de verrouillage: $LOCK_FILE"
}


# Fonction pour libérer le verrou
release_lock() {
    # Only remove the lock file if it contains the current PID
    if [ -f "$LOCK_FILE" ] && [[ "$(cat "$LOCK_FILE")" == "$$" ]]; then
        rm -f "$LOCK_FILE"
    fi
}

# Fonction pour nettoyer en cas d'erreur ou d'exit
cleanup() {
    # $? holds the exit status of the last command
    local exit_status=$?
    release_lock
    # Exit with the original exit status
    exit $exit_status
}

# Configuration du trap pour le nettoyage sur EXIT, INT, TERM
# Using EXIT trap handles normal exit and signals like INT, TERM
trap cleanup EXIT

# Fonction pour afficher un résumé des changements
show_summary() {
    local context=$1 # e.g., "projet principal" or "sous-module X"
    local repo_path=$2 # "." or "path/to/submodule"

    local repo_display_name=$context # Use context for display name

    echo -e "\n${BLUE}📊 Résumé des changements dans '$repo_display_name' ($repo_path):${NC}"

    local original_dir=$(pwd)
    if ! cd "$repo_path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder au répertoire '$repo_path' pour '$repo_display_name'. Skipping summary.${NC}"
        return 1 # Indicate failure
    fi

    # Use git status --porcelain for a quick check if anything needs summarizing
    if ! git status --porcelain | grep -q .; then
         echo -e "${GREEN}✅ Aucun changement détecté dans '$repo_display_name'.${NC}"
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $repo_path"
         return 0 # Indicate success (no changes)
    fi


    # Get detailed diff status using plumbing for reliability
    local added=$(git diff --cached --name-only --diff-filter=A 2>/dev/null)
    local modified=$(git diff --cached --name-only --diff-filter=M 2>/dev/null)
    local deleted=$(git diff --cached --name-only --diff-filter=D 2>/dev/null)
    local untracked=$(git ls-files --others --exclude-standard)

    local staged_summary=$(git diff --cached --shortstat 2>/dev/null || echo "Aucun changement stagé")
    local unstaged_summary=$(git diff --shortstat 2>/dev/null || echo "Aucun changement non stagé")


    if [[ -n "$added" ]]; then
        echo -e "${GREEN}  ➕ Stagéd Ajoutés :${NC}"
        printf "    - %s\n" $added
    fi
     if [[ -n "$modified" ]]; then
        echo -e "${YELLOW}  ✏️ Stagéd Modifiés :${NC}"
        printf "    - %s\n" $modified
    fi
    if [[ -n "$deleted" ]]; then
        echo -e "${RED}  ➖ Stagéd Supprimés :${NC}"
        printf "    - %s\n" $deleted
    fi
    echo -e "${BLUE}  📊 Résumé Stagéd : $staged_summary${NC}"


    # Show unstaged changes too, as the commit function adds everything
    echo -e "\n${BLUE}  📋 Changements Non Stagéd (seront inclus par 'git add .'):${NC}"
    local unstaged=$(git status --porcelain | grep '^ M\|^ D\|^ A') # Focus on tracked files with unstaged changes
    if [[ -n "$untracked" ]]; then
        echo -e "${YELLOW}    ❓ Fichiers Non Suivis:${NC}"
        printf "      - %s\n" $untracked
    fi
     if [[ -n "$unstaged" ]]; then
        echo -e "${YELLOW}    ❗ Modifiés/Supprimés Non Stagéd:${NC}"
        printf "      - %s\n" $unstaged | sed 's/^ *//' # Basic formatting
    fi
     echo -e "${BLUE}  📊 Résumé Non Stagéd : $unstaged_summary${NC}"

    # Optionally show diff excerpts (can be very verbose)
    # echo -e "${BLUE}  🧾 Extrait des diffs (stagéd) :${NC}"
    # git diff --cached | head -n $MAX_DIFF_LINES | sed 's/^/      /'


    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $repo_path"
    return 0 # Indicate success
}


# Fonction pour demander confirmation
ask_confirmation() {
    local context=$1 # e.g., "projet principal" or "sous-module X"
    if [[ "$NO_CONFIRM" == "true" ]]; then
        return 0 # Confirmation skipped
    fi

    # Loop until valid input (o/O/y/Y or n/N)
    while true; do
        read -p "Valider le commit et push de '$context' ? (o/n) : " confirm
        if [[ "$confirm" =~ ^[oOyY]$ ]]; then
            return 0 # Confirmed
        elif [[ "$confirm" =~ ^[nN]$ ]]; then
            return 1 # Not confirmed
        else
            echo -e "${YELLOW}⚠️ Réponse invalide. Veuillez entrer 'o' pour oui ou 'n' pour non.${NC}"
        fi
    done
}

# Fonction pour normaliser les chemins (simplifiée)
normalize_path() {
    local path_input=$1
    # Basic cleaning: remove leading/trailing whitespace
    path_input=$(echo "$path_input" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')

    # If it's '.', return it directly
    if [[ "$path_input" == "." ]]; then
        echo "."
        return 0
    fi

    # Use realpath for robust absolute path resolution
    if realpath "$path_input" > /dev/null 2>&1; then
        realpath "$path_input"
    else
        echo -e "${YELLOW}⚠️ Impossible de résoudre le chemin '$path_input' avec realpath. Utilisation du chemin tel quel.${NC}" >&2 # Print warning to stderr
        echo "$path_input" # Return original path on failure
    fi
}


# Fonction pour créer un backup
create_backup() {
    local source_path=$1 # Path to the directory to backup
    local repo_name=$2   # Name for the backup file prefix (e.g., "principal" or submodule name)

    # Check if backups are disabled
    if [[ "$NO_BACKUP" == "true" ]] || [[ "$MAX_BACKUPS" -le 0 ]]; then
        echo -e "${YELLOW}ℹ️  Création de backup désactivée.${NC}"
        return 0
    fi

    local resolved_source_path
    resolved_source_path=$(normalize_path "$source_path")
    if [[ -z "$resolved_source_path" ]] || [[ ! -d "$resolved_source_path" ]]; then
         echo -e "${RED}❌ Chemin source invalide pour le backup: '$source_path' -> '$resolved_source_path'. Backup annulé.${NC}"
         return 1
    fi


    # Resolve backup directory path
    local resolved_backup_dir
    resolved_backup_dir=$(normalize_path "$BACKUP_DIR")
     if [[ -z "$resolved_backup_dir" ]]; then
         echo -e "${RED}❌ Chemin de backup invalide: '$BACKUP_DIR'. Backup annulé.${NC}"
         return 1
    fi

    # Ensure the specific backup directory for the repo exists
    # Use repo_name which should be filesystem safe (e.g. "principal", "submodule_name")
    local target_backup_subdir="$resolved_backup_dir/$repo_name"
    mkdir -p "$target_backup_subdir" || {
        echo -e "${RED}❌ Impossible de créer le répertoire de backup: '$target_backup_subdir'. Backup annulé.${NC}";
        return 1;
    }


    # Create backup name with timestamp
    local timestamp=$(date +%Y%m%d_%H%M%S)
    # Ensure repo_name is filesystem-friendly (replace slashes perhaps, though submodule names shouldn't have them)
    local safe_repo_name=$(echo "$repo_name" | sed 's|/|_|g')
    local backup_filename="${safe_repo_name}_${timestamp}.tar.gz"
    local full_backup_path="$target_backup_subdir/$backup_filename"

    echo -e "${BLUE}📦 Création du backup de '$repo_name' vers '$full_backup_path'...${NC}"

    # Create the backup using tar. Exclude the backup dir itself if it's inside the source_path
    # Also exclude .git directory by default
    local tar_options=(-czf "$full_backup_path" --exclude=".git" --exclude="$BACKUP_DIR")
    # If BACKUP_DIR is relative, make its exclusion relative to source path
    if [[ "$BACKUP_DIR" != /* ]] && [[ "$resolved_source_path" != "$resolved_backup_dir"* ]]; then
         # Find relative path from source to backup dir if possible, otherwise keep absolute exclude
         local relative_backup_exclude=$(realpath --relative-to="$resolved_source_path" "$resolved_backup_dir" 2>/dev/null)
         if [[ -n "$relative_backup_exclude" ]]; then
             tar_options+=("--exclude=$relative_backup_exclude")
         fi
    fi


    if ! tar "${tar_options[@]}" -C "$resolved_source_path" . 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Impossible de créer le backup '$full_backup_path'. Vérifiez les permissions et l'espace disque. Continuation sans backup.${NC}"
        # Optionally remove potentially incomplete backup file
        rm -f "$full_backup_path"
        return 0 # Continue script execution even if backup fails
    fi

    # Clean up old backups
    # Use find for safer handling of filenames and sorting
    local backup_files_to_delete=$(find "$target_backup_subdir" -maxdepth 1 -name "${safe_repo_name}_*.tar.gz" -type f -printf '%T@ %p\n' | sort -nr | tail -n +$(($MAX_BACKUPS + 1)) | cut -d' ' -f2-)

    if [[ -n "$backup_files_to_delete" ]]; then
        echo -e "${BLUE}🧹 Nettoyage des anciens backups (> $MAX_BACKUPS)...${NC}"
        echo "$backup_files_to_delete" | while IFS= read -r file_to_delete; do
             if [[ -n "$file_to_delete" ]]; then # Ensure not empty line
                echo "  Suppression: $file_to_delete"
                rm -f "$file_to_delete" || echo -e "${YELLOW}⚠️ Impossible de supprimer l'ancien backup '$file_to_delete'${NC}"
            fi
        done
    fi


    echo -e "${GREEN}✅ Backup créé : $full_backup_path${NC}"
    return 0
}


# Fonction pour vérifier les conflits
check_conflicts() {
    local repo_path=$1
    local repo_name=$2

    if [[ "$CONFLICT_CHECK" == "false" ]]; then
        echo -e "${YELLOW}ℹ️  Vérification des conflits désactivée pour '$repo_name'.${NC}"
        return 0
    fi

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
    if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder à '$repo_path' pour vérifier les conflits de '$repo_name'. Vérification ignorée.${NC}"
        cd "$original_dir" # Go back if cd failed partially
        return 1 # Indicate failure
    fi

    echo -e "${BLUE}🔍 Vérification des conflits dans '$repo_name'...${NC}"

    # Use git status to check for conflicts (lines starting with UU)
    local conflicts=$(git status --porcelain | grep '^UU')

    if [[ -n "$conflicts" ]]; then
        echo -e "${RED}❌ Conflits détectés dans '$repo_name' :${NC}"
        printf "    %s\n" "$conflicts" # Print each conflict line
        # Go back before handling error
        cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
        handle_error "Résolvez les conflits dans '$repo_name' avant de pousser."
    fi

    echo -e "${GREEN}✅ Aucun conflit détecté dans '$repo_name'.${NC}"
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}


# Fonction pour vérifier la branche
check_branch() {
    local repo_path=$1
    local repo_name=$2
    # SPECIFIED_BRANCH comes from command line args or defaults

    if [[ "$BRANCH_CHECK" == "false" ]] || [[ -z "$SPECIFIED_BRANCH" ]]; then
         # Skip if check disabled OR no specific branch was requested
        if [[ "$BRANCH_CHECK" == "false" ]]; then
             echo -e "${YELLOW}ℹ️  Vérification de la branche désactivée pour '$repo_name'.${NC}"
        fi
        return 0
    fi

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
     if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder à '$repo_path' pour vérifier la branche de '$repo_name'. Vérification ignorée.${NC}"
         cd "$original_dir"
        return 1 # Indicate failure
    fi


    echo -e "${BLUE}🌿 Vérification de la branche dans '$repo_name' (doit être '$SPECIFIED_BRANCH')...${NC}"

    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [[ -z "$current_branch" ]]; then
         echo -e "${RED}❌ Impossible de déterminer la branche actuelle dans '$repo_name'. Vérification ignorée.${NC}"
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 1 # Indicate failure
    fi


    if [[ "$current_branch" != "$SPECIFIED_BRANCH" ]]; then
        echo -e "${YELLOW}⚠️  Branche actuelle '$current_branch' dans '$repo_name' diffère de la branche demandée '$SPECIFIED_BRANCH'.${NC}"
        # Optionally add logic here to ask the user if they want to switch branches
        # For now, just warn or error out
        # read -p "Voulez-vous changer pour la branche '$SPECIFIED_BRANCH' ? (o/n) " -n 1 -r REPLY
        # echo
        # if [[ $REPLY =~ ^[YyOo]$ ]]; then
        #     git checkout "$SPECIFIED_BRANCH" || { cd "$original_dir"; handle_error "Échec du changement vers la branche '$SPECIFIED_BRANCH' dans '$repo_name'"; }
        #     echo -e "${GREEN}✅ Changé pour la branche '$SPECIFIED_BRANCH' dans '$repo_name'.${NC}"
        #     current_branch=$SPECIFIED_BRANCH # Update current branch variable
        # else
        #      cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
        #      handle_error "Opération annulée car la branche n'est pas '$SPECIFIED_BRANCH' dans '$repo_name'."
        # fi
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         handle_error "La branche actuelle ('$current_branch') dans '$repo_name' n'est pas la branche spécifiée ('$SPECIFIED_BRANCH')."

    fi

    echo -e "${GREEN}✅ Branche vérifiée dans '$repo_name' : '$current_branch'.${NC}"
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}

# Fonction pour vérifier le remote
check_remote() {
    local repo_path=$1
    local repo_name=$2
    # SPECIFIED_REMOTE comes from command line args or defaults

    if [[ "$REMOTE_CHECK" == "false" ]] || [[ -z "$SPECIFIED_REMOTE" ]]; then
         # Skip if check disabled OR no specific remote was requested
         if [[ "$REMOTE_CHECK" == "false" ]]; then
             echo -e "${YELLOW}ℹ️  Vérification du remote désactivée pour '$repo_name'.${NC}"
         fi
        return 0
    fi


    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
     if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder à '$repo_path' pour vérifier le remote de '$repo_name'. Vérification ignorée.${NC}"
         cd "$original_dir"
        return 1 # Indicate failure
    fi

    echo -e "${BLUE}☁️  Vérification du remote dans '$repo_name' (doit être '$SPECIFIED_REMOTE')...${NC}"


    local current_branch
    current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
     if [[ -z "$current_branch" ]]; then
         echo -e "${RED}❌ Impossible de déterminer la branche actuelle dans '$repo_name' pour vérifier le remote. Vérification ignorée.${NC}"
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 1 # Indicate failure
    fi

    # Check if the specified remote exists
    if ! git remote | grep -q "^${SPECIFIED_REMOTE}$"; then
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         handle_error "Le remote spécifié '$SPECIFIED_REMOTE' n'existe pas dans '$repo_name'."
    fi

    # Check the remote configured for the current branch (if any)
    local configured_remote
    configured_remote=$(git config branch.$current_branch.remote 2>/dev/null)

    if [[ -z "$configured_remote" ]]; then
         echo -e "${YELLOW}⚠️  Aucun remote configuré pour la branche '$current_branch' dans '$repo_name'. Push utilisera '$SPECIFIED_REMOTE'.${NC}"
         # Optionally set it here if desired:
         # echo -e "${BLUE}Configuration du remote '$SPECIFIED_REMOTE' pour la branche '$current_branch'...${NC}"
         # git branch --set-upstream-to="$SPECIFIED_REMOTE/$current_branch" "$current_branch" || { cd "$original_dir"; handle_error "Impossible de configurer le remote '$SPECIFIED_REMOTE' pour la branche '$current_branch' dans '$repo_name'"; }
    elif [[ "$configured_remote" != "$SPECIFIED_REMOTE" ]]; then
        echo -e "${YELLOW}⚠️  Remote configuré ('$configured_remote') pour la branche '$current_branch' dans '$repo_name' diffère du remote demandé ('$SPECIFIED_REMOTE').${NC}"
        # Optionally ask to change or error out
         # read -p "Voulez-vous changer le remote configuré pour '$SPECIFIED_REMOTE' ? (o/n) " -n 1 -r REPLY
         # echo
         # if [[ $REPLY =~ ^[YyOo]$ ]]; then
         #    echo -e "${BLUE}Configuration du remote '$SPECIFIED_REMOTE' pour la branche '$current_branch'...${NC}"
         #    git branch --set-upstream-to="$SPECIFIED_REMOTE/$current_branch" "$current_branch" || { cd "$original_dir"; handle_error "Impossible de configurer le remote '$SPECIFIED_REMOTE' pour la branche '$current_branch' dans '$repo_name'"; }
         # else
         #     cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         #     handle_error "Opération annulée car le remote configuré n'est pas '$SPECIFIED_REMOTE' dans '$repo_name'."
         # fi
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         handle_error "Le remote configuré ('$configured_remote') pour la branche '$current_branch' dans '$repo_name' n'est pas le remote spécifié ('$SPECIFIED_REMOTE')."

    fi

    echo -e "${GREEN}✅ Remote vérifié dans '$repo_name' : '$SPECIFIED_REMOTE' sera utilisé pour le push.${NC}"
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0
}

# Removed handle_stash function definition

# Fonction pour commiter les changements
commit_changes() {
    local context=$1   # e.g., "(projet principal)" or "(sous-module X)"
    local repo_name=$2 # e.g., "principal" or "submodule_name"
    local repo_path=$3 # e.g., "." or "path/to/submodule"

    local original_dir=$(pwd)
    local resolved_path
    resolved_path=$(normalize_path "$repo_path")
     if [[ -z "$resolved_path" ]] || ! cd "$resolved_path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder à '$repo_path' pour commiter les changements de '$repo_name'. Commit annulé.${NC}"
         cd "$original_dir"
        return 1 # Indicate failure
    fi

    echo -e "${BLUE}📝 Préparation du commit pour '$repo_name'...${NC}"

    # Add all changes (including untracked files)
    echo -e "${BLUE}  Ajout de tous les changements (git add .)...${NC}"
    if [[ -n "$TIMEOUT_CMD" ]]; then
        if ! $TIMEOUT_CMD "$TIMEOUT" git add .; then
             cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
             handle_error "Timeout ou erreur lors de l'ajout des fichiers pour '$repo_name'"
        fi
    else
        if ! git add .; then
             cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
             handle_error "Échec de l'ajout des fichiers (git add .) pour '$repo_name'"
        fi
    fi

     # Check if there are any changes staged for commit
    if ! git diff --cached --quiet --exit-code; then
        echo -e "${BLUE}  Génération du message de commit automatique...${NC}"
        # Construct commit message (simplified)
        local commit_msg="MAJ auto $context $(date +%Y-%m-%d_%H:%M:%S)"
        local staged_summary
        staged_summary=$(git diff --cached --shortstat)
        commit_msg+="\n\nRésumé des changements stagés:\n$staged_summary"

        # Add list of changed files (optional, can make message long)
        # local changed_files=$(git diff --cached --name-status)
        # commit_msg+="\n\nFichiers modifiés:\n$changed_files"

        echo -e "${BLUE}  Commit des changements stagés...${NC}"
        # Commit with timeout if available
        if [[ -n "$TIMEOUT_CMD" ]]; then
            if ! echo -e "$commit_msg" | $TIMEOUT_CMD "$TIMEOUT" git commit --file=-; then
                 cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
                 handle_error "Timeout ou erreur lors du commit pour '$repo_name'"
            fi
        else
             if ! echo -e "$commit_msg" | git commit --file=-; then
                 cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
                 handle_error "Échec du commit pour '$repo_name'"
            fi
        fi
         echo -e "${GREEN}✅ Commit effectué dans '$repo_name'.${NC}"
    else
        echo -e "${GREEN}✅ Aucun changement stagé à commiter dans '$repo_name'.${NC}"
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
# These are now primarily set by load_config or configure_interactive
# CONFLICT_CHECK=true
# BRANCH_CHECK=true
# REMOTE_CHECK=true
SPECIFIC_SUBMODULES=()
SPECIFIC_SUBMODULE=""
SPECIFIED_BRANCH=""
SPECIFIED_REMOTE=""
TIMEOUT=$DEFAULT_TIMEOUT
CONFIG_FILE=".git/push.config" # Default config file path

# Traitement des arguments
# Use getopt for more robust parsing
TEMP=$(getopt -o hc:iSa:msn --long help,config:,interactive,show-config,all,main,submodules,no-confirm,submodule:,submodules:,timeout:,no-backup,no-conflict-check,no-branch-check,no-remote-check,backup-dir:,max-backups:,branch:,remote: -n "$0" -- "$@")

if [ $? != 0 ] ; then echo -e "${RED}Erreur lors de l'analyse des options.${NC}" >&2 ; show_help; exit 1 ; fi

# Note the quotes around "$TEMP": they are essential!
eval set -- "$TEMP"

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
NO_BACKUP=false
NO_CONFLICT_CHECK_ARG=false # Use different var names to distinguish from config values
NO_BRANCH_CHECK_ARG=false
NO_REMOTE_CHECK_ARG=false
# Removed NO_AUTO_STASH_ARG
BACKUP_DIR_ARG=""
MAX_BACKUPS_ARG=""
SPECIFIED_BRANCH_ARG=""
SPECIFIED_REMOTE_ARG=""


while true; do
  case "$1" in
    -h | --help ) show_help; exit 0 ;;
    -c | --config ) CONFIG_FILE_ARG="$2"; shift 2 ;;
    -i | --interactive ) INTERACTIVE_MODE=true; shift ;;
    -S | --show-config ) SHOW_CONFIG_MODE=true; shift ;; # Changed from -s
    -a | --all ) PUSH_ALL=true; shift ;;
    -m | --main ) PUSH_MAIN=true; shift ;;
    -s | --submodules ) PUSH_SUBMODULES=true; shift ;; # Keep -s for submodules for now
    -n | --no-confirm ) NO_CONFIRM=true; shift ;;
    --submodule ) SPECIFIC_SUBMODULE="$2"; shift 2 ;;
    --submodules ) IFS=',' read -ra SPECIFIC_SUBMODULES <<< "$2"; shift 2 ;;
    --timeout ) TIMEOUT_ARG="$2"; shift 2 ;;
    --no-backup ) NO_BACKUP=true; shift ;;
    --no-conflict-check ) NO_CONFLICT_CHECK_ARG=true; shift ;;
    --no-branch-check ) NO_BRANCH_CHECK_ARG=true; shift ;;
    --no-remote-check ) NO_REMOTE_CHECK_ARG=true; shift ;;
    # Removed --no-auto-stash case
    --backup-dir ) BACKUP_DIR_ARG="$2"; shift 2 ;;
    --max-backups ) MAX_BACKUPS_ARG="$2"; shift 2 ;;
    --branch ) SPECIFIED_BRANCH_ARG="$2"; shift 2 ;;
    --remote ) SPECIFIED_REMOTE_ARG="$2"; shift 2 ;;
    -- ) shift; break ;;
    * ) echo "Erreur interne de parsing!"; exit 1 ;;
  esac
done

# --- Configuration Loading and Prioritization ---

# 1. Set default config file path if not provided via arg
if [[ -n "$CONFIG_FILE_ARG" ]]; then
    CONFIG_FILE="$CONFIG_FILE_ARG"
fi

# 2. Load config from file (sets defaults like DEFAULT_BRANCH etc.)
# Also sets current operational values (BRANCH_CHECK, etc.) if defined in file
load_config "$CONFIG_FILE"

# 3. Handle interactive mode
if [[ "$INTERACTIVE_MODE" == "true" ]]; then
    configure_interactive # This loads, prompts, updates, and saves config
    # Refresh current operational values after interactive config
    load_config "$CONFIG_FILE"
    exit 0 # Exit after configuration
fi

# 4. Handle show config mode
if [[ "$SHOW_CONFIG_MODE" == "true" ]]; then
    show_config # Loads and shows current config
    exit 0 # Exit after showing config
fi

# 5. Apply command-line arguments, overriding config file values where applicable
# Behaviour flags
if [[ "$NO_CONFLICT_CHECK_ARG" == "true" ]]; then CONFLICT_CHECK=false; fi
if [[ "$NO_BRANCH_CHECK_ARG" == "true" ]]; then BRANCH_CHECK=false; fi
if [[ "$NO_REMOTE_CHECK_ARG" == "true" ]]; then REMOTE_CHECK=false; fi
# Value overrides
if [[ -n "$BACKUP_DIR_ARG" ]]; then BACKUP_DIR="$BACKUP_DIR_ARG"; fi
if [[ -n "$MAX_BACKUPS_ARG" ]]; then
     if ! [[ "$MAX_BACKUPS_ARG" =~ ^[0-9]+$ ]]; then handle_error "Le nombre de backups (--max-backups) doit être un nombre entier"; fi
     MAX_BACKUPS="$MAX_BACKUPS_ARG"
fi
if [[ -n "$SPECIFIED_BRANCH_ARG" ]]; then SPECIFIED_BRANCH="$SPECIFIED_BRANCH_ARG"; fi
if [[ -n "$SPECIFIED_REMOTE_ARG" ]]; then SPECIFIED_REMOTE="$SPECIFIED_REMOTE_ARG"; fi
if [[ -n "$TIMEOUT_ARG" ]]; then
     if ! [[ "$TIMEOUT_ARG" =~ ^[0-9]+$ ]]; then handle_error "Le timeout (--timeout) doit être un nombre entier"; fi
     TIMEOUT="$TIMEOUT_ARG"
fi


# Set default branch/remote if still empty after config and args
DEFAULT_BRANCH=${DEFAULT_BRANCH:-master}
DEFAULT_REMOTE=${DEFAULT_REMOTE:-origin}
# Use default branch/remote if specific ones weren't provided
SPECIFIED_BRANCH=${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}
SPECIFIED_REMOTE=${SPECIFIED_REMOTE:-$DEFAULT_REMOTE}


# --- Execution Logic ---

# Check prerequisites before locking
check_prerequisites

# Acquire lock
acquire_lock # Trap will handle release

# Determine default action if none specified
if [[ "$PUSH_ALL" == "false" && "$PUSH_MAIN" == "false" && "$PUSH_SUBMODULES" == "false" && -z "$SPECIFIC_SUBMODULE" && ${#SPECIFIC_SUBMODULES[@]} -eq 0 ]]; then
    echo -e "${YELLOW}ℹ️  Aucune action spécifiée (-a, -m, -s, --submodule), utilisation de --all par défaut.${NC}"
    PUSH_ALL=true
fi

# --- Submodule Processing ---

process_submodule() {
    local name=$1
    local path=$2

    # Use normalize_path for consistency, check return value
    local resolved_path
    resolved_path=$(normalize_path "$path")
    if [[ -z "$resolved_path" ]] || [[ ! -d "$resolved_path" ]]; then
         echo -e "${RED}❌ Chemin invalide ou inaccessible pour le sous-module '$name': '$path' -> '$resolved_path'. Ignoré.${NC}"
         return 1 # Indicate failure
    fi

    echo -e "\n${BLUE}=== Traitement du Sous-module : '$name' ($resolved_path) ===${NC}"

    local original_dir=$(pwd)
    if ! cd "$resolved_path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder au répertoire du sous-module '$name' ($resolved_path). Ignoré.${NC}"
        cd "$original_dir" # Go back if cd failed partially
        return 1 # Indicate failure
    fi

    # Run checks sequentially, handle potential errors from checks
    if ! check_conflicts "$resolved_path" "$name"; then cd "$original_dir"; return 1; fi
    if ! check_branch "$resolved_path" "$name"; then cd "$original_dir"; return 1; fi # Pass SPECIFIED_BRANCH implicitly
    if ! check_remote "$resolved_path" "$name"; then cd "$original_dir"; return 1; fi # Pass SPECIFIED_REMOTE implicitly
    # Removed handle_stash call

    # Check for changes *after* potential checks/modifications
    # Use git status --porcelain again to be sure
    if ! git status --porcelain | grep -q .; then
         echo -e "${GREEN}✅ Aucun changement détecté dans '$name' après vérifications.${NC}"
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 0 # Success (no changes)
    fi


    # Show summary of changes to be committed/pushed
    show_summary "$name" "$resolved_path" # Pass resolved path

    # Ask for confirmation
    if ! ask_confirmation "$name"; then
        echo -e "${YELLOW}⏭️  Commit et Push du sous-module '$name' annulés par l'utilisateur.${NC}"
        cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
        return 0 # User cancelled, not an error
    fi

    # Create backup before commit/push
    # Pass resolved_path and name
    create_backup "$resolved_path" "$name" # Continue even if backup fails

    # Commit changes (adds all changes)
    if ! commit_changes "(sous-module $name)" "$name" "$resolved_path"; then
         # commit_changes should handle its own errors and exit or return non-zero
         # If it returns non-zero, we stop processing this submodule
         echo -e "${RED}❌ Échec du commit pour le sous-module '$name'. Push annulé.${NC}"
         cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
         return 1
    fi


    # Determine branch and remote for push
    # Use SPECIFIED_BRANCH and SPECIFIED_REMOTE determined earlier
    local push_branch=$SPECIFIED_BRANCH
    local push_remote=$SPECIFIED_REMOTE


    echo -e "${GREEN}🚀 Push '$name' ($push_branch) → '$push_remote'...${NC}"

    # Push with timeout if available
    local push_cmd=(git push "$push_remote" "$push_branch")
    if [[ -n "$TIMEOUT_CMD" ]]; then
        if ! $TIMEOUT_CMD "$TIMEOUT" "${push_cmd[@]}"; then
             cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
             handle_error "Timeout ou erreur lors du push de '$name' vers '$push_remote/$push_branch'"
        fi
    else
        if ! "${push_cmd[@]}"; then
             cd "$original_dir" || echo -e "${YELLOW}⚠️ Impossible de revenir au répertoire original depuis $resolved_path${NC}" >&2
             handle_error "Échec du push de '$name' vers '$push_remote/$push_branch'"
        fi
    fi

    echo -e "${GREEN}✅ Push de '$name' terminé.${NC}"
    cd "$original_dir" || handle_error "Impossible de revenir au répertoire original depuis $resolved_path"
    return 0 # Success
}


# --- Main Processing Logic ---

# Process Submodules if requested
if [[ "$PUSH_ALL" == "true" || "$PUSH_SUBMODULES" == "true" || -n "$SPECIFIC_SUBMODULE" || ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
    echo -e "\n${BLUE}🔍 Analyse et traitement des sous-modules...${NC}"

    # Get list of submodules reliably
    submodule_list=$(git submodule status --recursive | awk '{print $2}') # Get paths reliably

    if [[ -z "$submodule_list" ]]; then
         echo -e "${YELLOW}ℹ️  Aucun sous-module trouvé ou enregistré dans ce dépôt.${NC}"
    else
        processed_any_submodule=false
        # Iterate over submodule paths
        echo "$submodule_list" | while IFS= read -r sub_path; do
            # Get submodule name from path (usually the same, but path is key)
            sub_name=$(basename "$sub_path") # Or use git config -f .gitmodules submodule.$sub_path.path ? No, status path is correct.

             # Trim leading/trailing whitespace just in case
            sub_path=$(echo "$sub_path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            sub_name=$(echo "$sub_name" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')


             # Check if this submodule should be processed
            process_this=false
            if [[ "$PUSH_ALL" == "true" ]] || [[ "$PUSH_SUBMODULES" == "true" ]]; then
                process_this=true
            elif [[ -n "$SPECIFIC_SUBMODULE" && ( "$sub_name" == "$SPECIFIC_SUBMODULE" || "$sub_path" == "$SPECIFIC_SUBMODULE" ) ]]; then
                 process_this=true
            elif [[ ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
                 for requested_sub in "${SPECIFIC_SUBMODULES[@]}"; do
                     if [[ "$sub_name" == "$requested_sub" ]] || [[ "$sub_path" == "$requested_sub" ]]; then
                         process_this=true
                         break
                     fi
                 done
            fi


            if [[ "$process_this" == "true" ]]; then
                processed_any_submodule=true
                # Pass name and path to the processing function
                # Use sub_path as the primary identifier and for cd
                # Use sub_name for display/logging purposes
                process_submodule "$sub_name" "$sub_path"
                 # Check exit code? Maybe continue on error? For now, errors are fatal via handle_error.
            fi
        done # End while loop for submodules

        if [[ "$processed_any_submodule" == "false" ]]; then
            echo -e "${YELLOW}ℹ️  Aucun sous-module ne correspond aux critères spécifiés. (${SPECIFIC_SUBMODULE:-}${SPECIFIC_SUBMODULES[*]:+ , ${SPECIFIC_SUBMODULES[*]}})${NC}"
        fi
    fi # End check for empty submodule list
fi


# Process Main Project if requested
if [[ "$PUSH_ALL" == "true" || "$PUSH_MAIN" == "true" ]]; then
    echo -e "\n${BLUE}=== Traitement du Projet Principal (.) ===${NC}"

     # Run checks sequentially for the main repo (".")
    if ! check_conflicts "." "projet principal"; then exit 1; fi # Errors handled within check functions now
    if ! check_branch "." "projet principal"; then exit 1; fi
    if ! check_remote "." "projet principal"; then exit 1; fi
    # Removed handle_stash call for main project


    # Check for changes in main repo
     if ! git status --porcelain | grep -q .; then
         echo -e "${GREEN}✅ Aucun changement détecté dans le projet principal après vérifications.${NC}"
    else
         # Show summary for main repo
        show_summary "projet principal" "."

        # Ask for confirmation for main repo
        if ! ask_confirmation "projet principal"; then
            echo -e "${YELLOW}⏭️  Commit et Push du projet principal annulés par l'utilisateur.${NC}"
        else
             # Create backup for main repo
            create_backup "." "principal"

            # Commit changes for main repo
            if ! commit_changes "(projet principal)" "principal" "."; then
                 echo -e "${RED}❌ Échec du commit pour le projet principal. Push annulé.${NC}"
                 exit 1 # Exit if commit fails
            fi

             # Determine branch and remote for push
            push_branch=$SPECIFIED_BRANCH
            push_remote=$SPECIFIED_REMOTE


            echo -e "${GREEN}🚀 Push projet principal ($push_branch) → '$push_remote'...${NC}"

            # Push main repo with timeout if available
            push_cmd=(git push "$push_remote" "$push_branch")
            if [[ -n "$TIMEOUT_CMD" ]]; then
                 if ! $TIMEOUT_CMD "$TIMEOUT" "${push_cmd[@]}"; then
                     handle_error "Timeout ou erreur lors du push du projet principal vers '$push_remote/$push_branch'"
                 fi
            else
                 if ! "${push_cmd[@]}"; then
                    handle_error "Échec du push du projet principal vers '$push_remote/$push_branch'"
                 fi
            fi
             echo -e "${GREEN}✅ Push du projet principal terminé.${NC}"
        fi # End confirmation check
    fi # End changes check
fi # End main project processing


# Final message (trap handles lock release)
echo -e "\n${GREEN}✅ Opération terminée.${NC}"
exit 0