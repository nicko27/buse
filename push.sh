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
AUTO_STASH=true
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
        BACKUP_DIR=${DEFAULT_BACKUP_DIR:-.git/backups}
        MAX_BACKUPS=${DEFAULT_MAX_BACKUPS:-5}
        CONFLICT_CHECK=${DEFAULT_CONFLICT_CHECK:-true}
        BRANCH_CHECK=${DEFAULT_BRANCH_CHECK:-true}
        REMOTE_CHECK=${DEFAULT_REMOTE_CHECK:-true}
        AUTO_STASH=${DEFAULT_AUTO_STASH:-true}
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
DEFAULT_AUTO_STASH="$AUTO_STASH"
EOF
    echo -e "${GREEN}✅ Configuration sauvegardée dans $config_file${NC}"
}

# Fonction pour configurer interactivement
configure_interactive() {
    echo -e "${BLUE}📝 Configuration interactive${NC}"
    
    # Demander le fichier de configuration
    read -p "Fichier de configuration [push_config.cfg] : " CONFIG_FILE
    CONFIG_FILE=${CONFIG_FILE:-push_config.cfg}
    
    # Charger la configuration existante si elle existe
    if [ -f "$CONFIG_FILE" ]; then
        echo -e "${GREEN}✅ Chargement de la configuration existante...${NC}"
        source "$CONFIG_FILE"
    else
        echo -e "${YELLOW}⚠️  Création d'une nouvelle configuration...${NC}"
        # Initialiser les valeurs par défaut
        DEFAULT_BRANCH="master"
        DEFAULT_REMOTE="origin"
        DEFAULT_BACKUP_DIR=".git/backups"
        DEFAULT_MAX_BACKUPS="5"
        DEFAULT_CONFLICT_CHECK="o"
        DEFAULT_BRANCH_CHECK="o"
        DEFAULT_REMOTE_CHECK="o"
        DEFAULT_AUTO_STASH="o"
    fi
    
    # Convertir les valeurs booléennes en o/n
    local conflict_check=$( [[ "$DEFAULT_CONFLICT_CHECK" == "true" ]] && echo "o" || echo "n" )
    local branch_check=$( [[ "$DEFAULT_BRANCH_CHECK" == "true" ]] && echo "o" || echo "n" )
    local remote_check=$( [[ "$DEFAULT_REMOTE_CHECK" == "true" ]] && echo "o" || echo "n" )
    local auto_stash=$( [[ "$DEFAULT_AUTO_STASH" == "true" ]] && echo "o" || echo "n" )
    
    # Branche par défaut
    read -p "Branche par défaut [${DEFAULT_BRANCH:-master}] : " input
    DEFAULT_BRANCH=${input:-${DEFAULT_BRANCH:-master}}
    
    # Remote par défaut
    read -p "Remote par défaut [${DEFAULT_REMOTE:-origin}] : " input
    DEFAULT_REMOTE=${input:-${DEFAULT_REMOTE:-origin}}
    
    # Répertoire de backup
    read -p "Répertoire de backup [${DEFAULT_BACKUP_DIR:-.git/backups}] : " input
    DEFAULT_BACKUP_DIR=${input:-${DEFAULT_BACKUP_DIR:-.git/backups}}
    
    # Nombre maximum de backups
    read -p "Nombre maximum de backups [${DEFAULT_MAX_BACKUPS:-5}] : " input
    DEFAULT_MAX_BACKUPS=${input:-${DEFAULT_MAX_BACKUPS:-5}}
    if ! [[ "$DEFAULT_MAX_BACKUPS" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}❌ Le nombre de backups doit être un nombre entier${NC}"
        DEFAULT_MAX_BACKUPS=5
    fi
    
    # Vérification des conflits
    read -p "Vérifier les conflits ? (o/n) [${conflict_check}] : " input
    input=${input:-${conflict_check}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_CONFLICT_CHECK="true" || DEFAULT_CONFLICT_CHECK="false"
    
    # Vérification des branches
    read -p "Vérifier les branches ? (o/n) [${branch_check}] : " input
    input=${input:-${branch_check}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_BRANCH_CHECK="true" || DEFAULT_BRANCH_CHECK="false"
    
    # Vérification des remotes
    read -p "Vérifier les remotes ? (o/n) [${remote_check}] : " input
    input=${input:-${remote_check}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_REMOTE_CHECK="true" || DEFAULT_REMOTE_CHECK="false"
    
    # Stash automatique
    read -p "Stash automatique ? (o/n) [${auto_stash}] : " input
    input=${input:-${auto_stash}}
    [[ "$input" =~ ^[oOyY]$ ]] && DEFAULT_AUTO_STASH="true" || DEFAULT_AUTO_STASH="false"
    
    # Mettre à jour les variables actuelles
    BACKUP_DIR=$DEFAULT_BACKUP_DIR
    MAX_BACKUPS=$DEFAULT_MAX_BACKUPS
    CONFLICT_CHECK=$DEFAULT_CONFLICT_CHECK
    BRANCH_CHECK=$DEFAULT_BRANCH_CHECK
    REMOTE_CHECK=$DEFAULT_REMOTE_CHECK
    AUTO_STASH=$DEFAULT_AUTO_STASH
    
    # Sauvegarde de la configuration
    save_config "$CONFIG_FILE"
}

# Fonction pour afficher la configuration actuelle
show_config() {
    echo -e "${BLUE}📋 Configuration actuelle :${NC}"
    echo "Branche par défaut : $DEFAULT_BRANCH"
    echo "Remote par défaut : $DEFAULT_REMOTE"
    echo "Répertoire de backup : $BACKUP_DIR"
    echo "Nombre maximum de backups : $MAX_BACKUPS"
    echo "Vérification des conflits : $CONFLICT_CHECK"
    echo "Vérification des branches : $BRANCH_CHECK"
    echo "Vérification des remotes : $REMOTE_CHECK"
    echo "Stash automatique : $AUTO_STASH"
}

# Fonction pour afficher l'aide
show_help() {
    echo -e "${BLUE}Usage: $0 [options]${NC}"
    echo -e "${BLUE}Options:${NC}"
    echo "  -h, --help              Affiche cette aide"
    echo "  -c, --config=FILE       Utilise le fichier de configuration spécifié"
    echo "  -i, --interactive       Configure ou modifie le fichier de configuration"
    echo "  -s, --show-config      Affiche la configuration actuelle"
    echo "  -a, --all               Pousse tous les changements (sous-modules + principal)"
    echo "  -m, --main              Pousse uniquement le projet principal"
    echo "  -s, --submodules        Pousse uniquement les sous-modules"
    echo "  -n, --no-confirm        Ne demande pas de confirmation"
    echo "  --submodule=NAME        Pousse uniquement le sous-module spécifié"
    echo "  --submodules=NAMES      Pousse les sous-modules spécifiés (séparés par des virgules)"
    echo "  --timeout=SECONDS       Délai d'attente pour les opérations Git (défaut: $DEFAULT_TIMEOUT)"
    echo "  --no-backup             Désactive la création de backup"
    echo "  --no-conflict-check     Désactive la vérification des conflits"
    echo "  --no-branch-check       Désactive la vérification des branches"
    echo "  --no-remote-check       Désactive la vérification des remotes"
    echo "  --no-auto-stash         Désactive le stash automatique"
    echo "  --backup-dir=DIR        Répertoire de backup (défaut: $BACKUP_DIR)"
    echo "  --max-backups=N         Nombre maximum de backups (défaut: $MAX_BACKUPS)"
    echo "  --branch=NAME           Spécifie la branche à pousser"
    echo "  --remote=NAME           Spécifie le remote à utiliser"
    echo ""
    echo -e "${BLUE}Exemples:${NC}"
    echo "  $0 -c config.cfg        # Utilise le fichier de configuration spécifié"
    echo "  $0 -i                   # Configure ou modifie le fichier de configuration"
    echo "  $0 -s                   # Affiche la configuration"
    echo "  $0 -a                   # Pousse tout avec confirmation"
    echo "  $0 -m -n                # Pousse le principal sans confirmation"
    echo "  $0 --submodule=module1  # Pousse uniquement module1"
    echo "  $0 --submodules=mod1,mod2 # Pousse mod1 et mod2"
    echo "  $0 --branch=develop     # Pousse sur la branche develop"
    echo "  $0 --remote=origin      # Pousse vers le remote origin"
}

# Fonction pour gérer les erreurs
handle_error() {
    local message=$1
    local code=${2:-1}
    echo -e "${RED}Erreur: $message${NC}" >&2
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
        handle_error "Ce répertoire n'est pas un dépôt Git"
    fi

    # Vérifier si les sous-modules sont initialisés
    if [ -f .gitmodules ] && ! git submodule status &> /dev/null; then
        echo -e "${YELLOW}Attention: Les sous-modules ne sont pas initialisés${NC}"
        read -p "Voulez-vous les initialiser ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[YyOo]$ ]]; then
            git submodule update --init --recursive || handle_error "Échec de l'initialisation des sous-modules"
        fi
    fi
}

# Fonction pour acquérir le verrou
acquire_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null; then
            handle_error "Une autre instance du script est en cours d'exécution (PID: $pid)"
        fi
    fi
    echo $$ > "$LOCK_FILE"
}

# Fonction pour libérer le verrou
release_lock() {
    rm -f "$LOCK_FILE"
}

# Fonction pour nettoyer en cas d'erreur
cleanup() {
    release_lock
    exit 1
}

# Configuration du trap pour le nettoyage
trap cleanup EXIT INT TERM

# Fonction pour afficher un résumé des changements
show_summary() {
    local context=$1
    local name=$2
    local path=$3

    # Normaliser les chemins
    path=$(normalize_path "$path")
    
    echo -e "\n${BLUE}📊 Résumé des changements dans $context :${NC}"
    
    if ! cd "$path" 2>/dev/null; then
        handle_error "Impossible d'accéder au répertoire $path"
    fi
    
    # Récupération des changements
    local added=$(git diff --name-only --diff-filter=A 2>/dev/null || echo "")
    local modified=$(git diff --name-only --diff-filter=M 2>/dev/null || echo "")
    local deleted=$(git diff --name-only --diff-filter=D 2>/dev/null || echo "")
    local summary=$(git diff --shortstat 2>/dev/null || echo "")

    if [[ -n "$added" ]]; then
        echo -e "${GREEN}  🟢 Ajoutés :${NC}"
        while read -r f; do
            [[ -n "$f" ]] && echo "    - $f"
        done <<< "$added"
    fi

    if [[ -n "$modified" ]]; then
        echo -e "${YELLOW}  ✏️ Modifiés :${NC}"
        while read -r f; do
            [[ -n "$f" ]] && echo "    - $f"
        done <<< "$modified"
    fi

    if [[ -n "$deleted" ]]; then
        echo -e "${RED}  ❌ Supprimés :${NC}"
        while read -r f; do
            [[ -n "$f" ]] && echo "    - $f"
        done <<< "$deleted"
    fi

    echo -e "${BLUE}  📊 Résumé : $summary${NC}"
    echo -e "${BLUE}  🧾 Extrait des diffs :${NC}"

    local all_files=$(echo -e "$added\n$modified")
    while read -r f; do
        [[ -n "$f" ]] && {
            echo "    $f"
            git diff "$f" | head -n $MAX_DIFF_LINES | sed 's/^/      /'
        }
    done <<< "$all_files"
    echo ""
    
    cd - >/dev/null
}

# Fonction pour demander confirmation
ask_confirmation() {
    local context=$1
    if [[ "$NO_CONFIRM" == "true" ]]; then
        return 0
    fi
    read -p "Valider le push de $context ? (o/n) : " confirm
    [[ "$confirm" =~ ^[oOyY]$ ]]
}

# Fonction pour normaliser les chemins
normalize_path() {
    local path=$1
    # Supprimer les guillemets et les espaces en début/fin
    path=$(echo "$path" | sed -e 's/^"//' -e 's/"$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
    # Remplacer les espaces multiples par un seul espace
    path=$(echo "$path" | sed -e 's/[[:space:]]\+/ /g')
    
    # Si le chemin est relatif, le rendre absolu
    if [[ "$path" != /* ]]; then
        # Sauvegarder le répertoire courant
        local current_dir=$(pwd)
        # Se déplacer à la racine du dépôt Git
        cd "$(git rev-parse --show-toplevel)" || return 1
        # Obtenir le chemin absolu
        path=$(realpath "$path")
        # Revenir au répertoire précédent
        cd "$current_dir" || return 1
    fi
    
    echo "$path"
}

# Fonction pour créer un backup
create_backup() {
    local path=$1
    local name=$2
    
    # Vérifier si les backups sont désactivés
    if [[ "$NO_BACKUP" == "true" || "$MAX_BACKUPS" -eq 0 ]]; then
        return 0
    fi
    
    # Normaliser les chemins
    path=$(normalize_path "$path")
    name=$(normalize_path "$name")
    
    # Créer le répertoire de backup
    local backup_path="$BACKUP_DIR/$(dirname "$name")"
    mkdir -p "$backup_path"
    
    # Création du nom du backup avec timestamp
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="${name##*/}_${timestamp}.tar.gz"
    local full_backup_path="$backup_path/$backup_name"
    
    echo -e "${BLUE}📦 Création du backup de $name...${NC}"
    
    # Création du backup
    if ! tar -czf "$full_backup_path" -C "$path" . 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Impossible de créer le backup, continuation sans backup${NC}"
        return 0
    fi
    
    # Nettoyage des anciens backups
    local backups=($(ls -t "$backup_path"/*.tar.gz 2>/dev/null))
    if [[ ${#backups[@]} -gt $MAX_BACKUPS ]]; then
        for ((i=$MAX_BACKUPS; i<${#backups[@]}; i++)); do
            rm -f "${backups[$i]}"
        done
    fi
    
    echo -e "${GREEN}✅ Backup créé : $backup_name${NC}"
}

# Fonction pour vérifier les conflits
check_conflicts() {
    local path=$1
    local name=$2
    
    if [[ "$CONFLICT_CHECK" == "false" ]]; then
        return 0
    fi
    
    # Normaliser les chemins
    path=$(normalize_path "$path")
    
    echo -e "${BLUE}🔍 Vérification des conflits dans $name...${NC}"
    
    if ! cd "$path" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Impossible d'accéder au répertoire $path, vérification des conflits ignorée${NC}"
        return 0
    fi
    
    local conflicts=$(git diff --name-only --diff-filter=U 2>/dev/null)
    
    if [[ -n "$conflicts" ]]; then
        echo -e "${RED}❌ Conflits détectés dans $name :${NC}"
        while read -r f; do
            [[ -n "$f" ]] && echo "    - $f"
        done <<< "$conflicts"
        handle_error "Résolvez les conflits avant de pousser"
    fi
    
    echo -e "${GREEN}✅ Aucun conflit détecté dans $name${NC}"
    cd - >/dev/null
}

# Fonction pour vérifier la branche
check_branch() {
    local path=$1
    local name=$2
    
    if [[ "$BRANCH_CHECK" == "false" ]]; then
        return 0
    fi
    
    # Normaliser les chemins
    path=$(normalize_path "$path")
    
    echo -e "${BLUE}🔍 Vérification de la branche dans $name...${NC}"
    
    if ! cd "$path" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Impossible d'accéder au répertoire $path, vérification de la branche ignorée${NC}"
        return 0
    fi
    
    local current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    
    if [[ -n "$SPECIFIED_BRANCH" && "$current_branch" != "$SPECIFIED_BRANCH" ]]; then
        echo -e "${YELLOW}⚠️  Vous n'êtes pas sur la branche $SPECIFIED_BRANCH dans $name${NC}"
        read -p "Voulez-vous changer de branche ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[YyOo]$ ]]; then
            git checkout "$SPECIFIED_BRANCH" || handle_error "Échec du changement de branche"
        else
            handle_error "Opération annulée"
        fi
    fi
    
    echo -e "${GREEN}✅ Branche vérifiée dans $name : $current_branch${NC}"
    cd - >/dev/null
}

# Fonction pour vérifier le remote
check_remote() {
    local path=$1
    local name=$2
    
    if [[ "$REMOTE_CHECK" == "false" ]]; then
        return 0
    fi
    
    # Normaliser les chemins
    path=$(normalize_path "$path")
    
    echo -e "${BLUE}🔍 Vérification du remote dans $name...${NC}"
    
    if ! cd "$path" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Impossible d'accéder au répertoire $path, vérification du remote ignorée${NC}"
        return 0
    fi
    
    local current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    local remote=$(git config branch.$current_branch.remote 2>/dev/null)
    
    if [[ -n "$SPECIFIED_REMOTE" && "$remote" != "$SPECIFIED_REMOTE" ]]; then
        echo -e "${YELLOW}⚠️  Le remote n'est pas $SPECIFIED_REMOTE dans $name${NC}"
        read -p "Voulez-vous changer de remote ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[YyOo]$ ]]; then
            git branch --set-upstream-to="$SPECIFIED_REMOTE/$current_branch" "$current_branch" || handle_error "Échec du changement de remote"
        else
            handle_error "Opération annulée"
        fi
    fi
    
    echo -e "${GREEN}✅ Remote vérifié dans $name : $remote${NC}"
    cd - >/dev/null
}

# Fonction pour gérer le stash
handle_stash() {
    local path=$1
    local name=$2
    
    if [[ "$AUTO_STASH" == "false" ]]; then
        return 0
    fi
    
    # Normaliser les chemins
    path=$(normalize_path "$path")
    
    if ! cd "$path" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Impossible d'accéder au répertoire $path, stash ignoré${NC}"
        return 0
    fi
    
    local status=$(git status --porcelain 2>/dev/null)
    
    if [[ -n "$status" ]]; then
        echo -e "${YELLOW}⚠️  Changements non commités détectés dans $name${NC}"
        read -p "Voulez-vous les stasher ? (o/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[YyOo]$ ]]; then
            # Rediriger la sortie standard vers /dev/null pour éviter le message "No local changes to save"
            git stash save "Auto-stash before push" >/dev/null 2>&1 || {
                echo -e "${YELLOW}⚠️  Échec du stash, continuation sans stash${NC}"
                return 0
            }
            echo -e "${GREEN}✅ Changements stasher dans $name${NC}"
        else
            echo -e "${YELLOW}⚠️  Stash refusé, continuation avec les changements non commités${NC}"
            return 0
        fi
    fi
    
    cd - >/dev/null
}

# Fonction pour commiter les changements
commit_changes() {
    local context=$1
    local name=$2
    local path=$3

    # Normaliser les chemins
    path=$(normalize_path "$path")
    
    if ! cd "$path" 2>/dev/null; then
        handle_error "Impossible d'accéder au répertoire $path"
    fi
    
    # Récupération des changements
    local added=$(git diff --name-only --diff-filter=A 2>/dev/null || echo "")
    local modified=$(git diff --name-only --diff-filter=M 2>/dev/null || echo "")
    local deleted=$(git diff --name-only --diff-filter=D 2>/dev/null || echo "")
    local summary=$(git diff --shortstat 2>/dev/null || echo "")

    local commit_msg="MAJ automatique $context :\n\n"

    if [[ -n "$added" ]]; then
        commit_msg+="🟢 Ajoutés :\n"
        while read -r f; do
            [[ -n "$f" ]] && commit_msg+="- $f\n"
        done <<< "$added"
        commit_msg+="\n"
    fi

    if [[ -n "$modified" ]]; then
        commit_msg+="✏️ Modifiés :\n"
        while read -r f; do
            [[ -n "$f" ]] && commit_msg+="- $f\n"
        done <<< "$modified"
        commit_msg+="\n"
    fi

    if [[ -n "$deleted" ]]; then
        commit_msg+="❌ Supprimés :\n"
        while read -r f; do
            [[ -n "$f" ]] && commit_msg+="- $f\n"
        done <<< "$deleted"
        commit_msg+="\n"
    fi

    commit_msg+="📊 Résumé : $summary\n"
    commit_msg+="🧾 Extrait des diffs :\n"

    local all_files=$(echo -e "$added\n$modified")
    while read -r f; do
        [[ -n "$f" ]] && {
            commit_msg+="\n$f\n"
            commit_msg+="$(git diff "$f" | head -n $MAX_DIFF_LINES | sed 's/^/    /')\n"
        }
    done <<< "$all_files"

    # Commit avec timeout si disponible
    if [[ -n "$TIMEOUT_CMD" ]]; then
        $TIMEOUT_CMD $TIMEOUT git add . || handle_error "Timeout lors de l'ajout des fichiers"
        echo -e "$commit_msg" | $TIMEOUT_CMD $TIMEOUT git commit -F - || handle_error "Timeout lors du commit"
    else
        git add . || handle_error "Échec de l'ajout des fichiers"
        echo -e "$commit_msg" | git commit -F - || handle_error "Échec du commit"
    fi
    
    cd - >/dev/null
}

# Variables par défaut
PUSH_ALL=false
PUSH_MAIN=false
PUSH_SUBMODULES=false
NO_CONFIRM=false
NO_BACKUP=false
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
AUTO_STASH=true
SPECIFIC_SUBMODULES=()
SPECIFIC_SUBMODULE=""
SPECIFIED_BRANCH=""
SPECIFIED_REMOTE=""
TIMEOUT=$DEFAULT_TIMEOUT

# Traitement des arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--config=*)
            if [[ "$1" == "-c" ]]; then
                shift
                CONFIG_FILE="$1"
            else
                CONFIG_FILE="${1#*=}"
            fi
            shift
            ;;
        -i|--interactive)
            configure_interactive
            exit 0
            ;;
        -s|--show-config)
            show_config
            exit 0
            ;;
        -a|--all)
            PUSH_ALL=true
            shift
            ;;
        -m|--main)
            PUSH_MAIN=true
            shift
            ;;
        -s|--submodules)
            PUSH_SUBMODULES=true
            shift
            ;;
        -n|--no-confirm)
            NO_CONFIRM=true
            shift
            ;;
        --submodule=*)
            SPECIFIC_SUBMODULE="${1#*=}"
            shift
            ;;
        --submodules=*)
            IFS=',' read -ra SPECIFIC_SUBMODULES <<< "${1#*=}"
            shift
            ;;
        --timeout=*)
            TIMEOUT="${1#*=}"
            if ! [[ "$TIMEOUT" =~ ^[0-9]+$ ]]; then
                handle_error "Le timeout doit être un nombre entier"
            fi
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --no-conflict-check)
            CONFLICT_CHECK=false
            shift
            ;;
        --no-branch-check)
            BRANCH_CHECK=false
            shift
            ;;
        --no-remote-check)
            REMOTE_CHECK=false
            shift
            ;;
        --no-auto-stash)
            AUTO_STASH=false
            shift
            ;;
        --backup-dir=*)
            BACKUP_DIR="${1#*=}"
            shift
            ;;
        --max-backups=*)
            MAX_BACKUPS="${1#*=}"
            if ! [[ "$MAX_BACKUPS" =~ ^[0-9]+$ ]]; then
                handle_error "Le nombre de backups doit être un nombre entier"
            fi
            shift
            ;;
        --branch=*)
            SPECIFIED_BRANCH="${1#*=}"
            shift
            ;;
        --remote=*)
            SPECIFIED_REMOTE="${1#*=}"
            shift
            ;;
        *)
            echo -e "${RED}Option inconnue: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Chargement de la configuration
load_config "$CONFIG_FILE"

# Si aucun argument n'est fourni et qu'aucun fichier de configuration n'existe, on demande la configuration
if [[ $# -eq 0 && ! -f "$CONFIG_FILE" ]]; then
    echo -e "${YELLOW}⚠️  Aucune configuration trouvée.${NC}"
    configure_interactive
fi

# Vérification des prérequis
check_prerequisites

# Acquisition du verrou
acquire_lock

# Si aucune option n'est spécifiée, on pousse tout
if [[ "$PUSH_ALL" == "false" && "$PUSH_MAIN" == "false" && "$PUSH_SUBMODULES" == "false" && -z "$SPECIFIC_SUBMODULE" && ${#SPECIFIC_SUBMODULES[@]} -eq 0 ]]; then
    PUSH_ALL=true
fi

# Fonction pour traiter un sous-module
process_submodule() {
    local name=$1
    local path=$2
    
    # Normaliser les chemins
    path=$(normalize_path "$path")
    name=$(normalize_path "$name")
    
    echo -e "\n${BLUE}📁 Sous-module : $name${NC}"
    echo -e "${YELLOW}Chemin : $path${NC}"
    
    # Vérifier si le répertoire existe
    if [ ! -d "$path" ]; then
        echo -e "${YELLOW}⚠️  Le répertoire $path n'existe pas, tentative d'initialisation...${NC}"
        git submodule update --init --recursive "$path" || {
            echo -e "${RED}❌ Impossible d'initialiser le sous-module $name${NC}"
            return 1
        }
    fi
    
    # Vérifications préalables
    check_conflicts "$path" "$name"
    check_branch "$path" "$name"
    check_remote "$path" "$name"
    handle_stash "$path" "$name"
    
    if ! cd "$path" 2>/dev/null; then
        echo -e "${RED}❌ Impossible d'accéder au répertoire $path${NC}"
        return 1
    fi
    
    if [[ -n $(git status --porcelain) ]]; then
        show_summary "sous-module $name" "$name" "$path"
        
        if ask_confirmation "sous-module $name"; then
            # Création du backup avant le commit
            create_backup "$path" "$name"
            
            commit_changes "(sous-module $name)" "$name" "$path"
            
            branch=$(git rev-parse --abbrev-ref HEAD)
            remote=$(git config branch.$branch.remote)
            echo -e "${GREEN}🚀 Push $name → $remote/$branch${NC}"
            
            # Push avec timeout si disponible
            if [[ -n "$TIMEOUT_CMD" ]]; then
                $TIMEOUT_CMD $TIMEOUT git push $remote $branch || {
                    echo -e "${RED}❌ Timeout lors du push de $name${NC}"
                    cd - >/dev/null
                    return 1
                }
            else
                git push $remote $branch || {
                    echo -e "${RED}❌ Échec du push de $name${NC}"
                    cd - >/dev/null
                    return 1
                }
            fi
        else
            echo -e "${YELLOW}⏭️  Push du sous-module $name annulé par l'utilisateur.${NC}"
        fi
    else
        echo -e "${GREEN}✅ Pas de changement dans $name${NC}"
    fi
    
    cd - >/dev/null
}

# Traitement des sous-modules
if [[ "$PUSH_ALL" == "true" || "$PUSH_SUBMODULES" == "true" || -n "$SPECIFIC_SUBMODULE" || ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
    echo -e "\n${BLUE}🔍 Analyse des sous-modules...${NC}"
    
    # Récupération de tous les sous-modules
    submodules=()
    while IFS= read -r line; do
        if [[ $line =~ ^(.+):(.+)$ ]]; then
            name="${BASH_REMATCH[1]}"
            path="${BASH_REMATCH[2]}"
            # Normaliser les chemins
            name=$(normalize_path "$name")
            path=$(normalize_path "$path")
            submodules+=("$name:$path")
        fi
    done < <(git submodule foreach --recursive 'echo $name:$path' 2>/dev/null)
    
    # Traitement des sous-modules selon les critères
    for submodule in "${submodules[@]}"; do
        IFS=':' read -r name path <<< "$submodule"
        
        # Vérifier si le sous-module doit être traité
        if [[ "$PUSH_ALL" == "true" || "$PUSH_SUBMODULES" == "true" ]] || \
           [[ -n "$SPECIFIC_SUBMODULE" && "$name" == "$SPECIFIC_SUBMODULE" ]] || \
           [[ ${#SPECIFIC_SUBMODULES[@]} -gt 0 && " ${SPECIFIC_SUBMODULES[*]} " =~ " $name " ]]; then
            process_submodule "$name" "$path" || continue
        fi
    done
fi

# Traitement du projet principal
if [[ "$PUSH_ALL" == "true" || "$PUSH_MAIN" == "true" ]]; then
    echo -e "\n${BLUE}📦 Vérification du projet principal...${NC}"
    
    # Vérifications préalables
    check_conflicts "." "projet principal"
    check_branch "." "projet principal"
    check_remote "." "projet principal"
    handle_stash "." "projet principal"
    
    if [[ -n $(git status --porcelain) ]]; then
        show_summary "projet principal" "principal" "."
        
        if ask_confirmation "projet principal"; then
            # Création du backup avant le commit
            create_backup "." "principal"
            
            commit_changes "(projet principal)" "principal" "."
            echo -e "${GREEN}🚀 Push du projet principal${NC}"
            
            # Push avec timeout si disponible
            if [[ -n "$TIMEOUT_CMD" ]]; then
                $TIMEOUT_CMD $TIMEOUT git push || handle_error "Timeout lors du push du projet principal"
            else
                git push || handle_error "Échec du push du projet principal"
            fi
        else
            echo -e "${YELLOW}⏭️  Push du projet principal annulé par l'utilisateur.${NC}"
        fi
    else
        echo -e "${GREEN}✅ Aucun changement dans le projet principal${NC}"
    fi
fi

# Libération du verrou
release_lock

echo -e "\n${GREEN}✅ Opération terminée avec succès${NC}"
