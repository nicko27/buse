#!/bin/bash

set -euo pipefail

# --- Configuration Initiale ---
# Couleurs (utilisées uniquement dans les fonctions de log spécifiques)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Valeurs par défaut (peuvent être surchargées par fichier ou arguments)
MAX_DIFF_LINES=10
DEFAULT_TIMEOUT=30
LOCK_FILE="/tmp/push.lock"
BACKUP_DIR=".git/backups" # Relatif à la racine du projet par défaut
MAX_BACKUPS=5
CONFLICT_CHECK=true
BRANCH_CHECK=true
REMOTE_CHECK=true
CONFIG_FILE=".git/push.config" # Relatif à la racine du projet par défaut
DEBUG_MODE=false
NO_BACKUP=false
GIT_TOPLEVEL="" # Sera défini après vérification Git

# --- Fonctions de Journalisation (Logging) ---
# Log Info (toujours visible, sans couleur par défaut)
log_info() {
    echo -e "$1"
}
# Log Erreur (toujours visible, en rouge)
log_error() {
    echo -e "${RED}❌ Erreur: $1${NC}" >&2
}
# Log Avertissement (toujours visible, en jaune)
log_warn() {
     echo -e "${YELLOW}⚠️  $1${NC}" >&2
}
# Log Succès (toujours visible, en vert)
log_success() {
     echo -e "${GREEN}✅ $1${NC}"
}
# Log Debug (visible si DEBUG_MODE=true, en cyan)
log_debug() {
    if [[ "$DEBUG_MODE" == "true" ]]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
}
# --- Fin Fonctions de Journalisation ---

# --- Fonctions Utilitaires ---

# Vérification de la commande timeout
TIMEOUT_CMD=""
if command -v timeout &> /dev/null; then
     TIMEOUT_CMD="timeout"
     log_debug "Commande 'timeout' trouvée."
else
    log_warn "La commande 'timeout' n'est pas disponible, désactivation des timeouts."
fi

# Obtenir le chemin absolu de la racine du dépôt Git
set_git_toplevel() {
    if ! GIT_TOPLEVEL=$(git rev-parse --show-toplevel 2>/dev/null); then
        # Cette erreur est fatale car tout le reste dépend de la racine
        log_error "Impossible de déterminer la racine du dépôt Git (git rev-parse --show-toplevel a échoué)."
        # Pas besoin de handle_error ici car le trap n'est pas encore actif et lock non pris
        exit 1
    fi
    # Vérifier si le chemin obtenu est valide
    if [[ -z "$GIT_TOPLEVEL" ]] || [[ ! -d "$GIT_TOPLEVEL" ]]; then
         log_error "Le chemin racine du dépôt Git obtenu ('$GIT_TOPLEVEL') est invalide."
         exit 1
    fi
    log_debug "Racine du dépôt Git détectée: $GIT_TOPLEVEL"
    # Naviguer vers la racine pour simplifier les chemins relatifs par la suite
    if ! cd "$GIT_TOPLEVEL"; then
        log_error "Impossible de se déplacer vers la racine du dépôt Git: $GIT_TOPLEVEL"
        exit 1
    fi
    log_debug "Déplacement vers la racine du dépôt: $(pwd)"
    # Mettre à jour les chemins relatifs par défaut pour qu'ils soient absolus ou relatifs à la racine
    CONFIG_FILE="$GIT_TOPLEVEL/$CONFIG_FILE"
    # BACKUP_DIR peut rester relatif s'il commence par '.', il sera résolu plus tard
    if [[ "$BACKUP_DIR" != /* && "$BACKUP_DIR" != .* ]]; then
         BACKUP_DIR="$GIT_TOPLEVEL/$BACKUP_DIR" # Rendre absolu si ce n'est pas déjà relatif à la racine
    fi
     log_debug "Chemin absolu config: $CONFIG_FILE"
     log_debug "Chemin backup dir (potentiellement relatif): $BACKUP_DIR"

}


# Charger la configuration depuis un fichier (chemin absolu attendu)
load_config() {
    local config_file=$1 # 'local' est correct ici (dans une fonction)
    log_debug "Tentative de chargement de la configuration depuis '$config_file'..."
    if [ -f "$config_file" ]; then
        # Utiliser 'source' pour charger les variables
        # Rediriger stderr pour attraper les erreurs de syntaxe dans le fichier config
        if source "$config_file" 2> /tmp/push_config_stderr_$$; then
            log_debug "Fichier de configuration '$config_file' chargé."
            # Appliquer les valeurs par défaut si non définies dans le fichier
            # Priorité: Variable déjà définie > Fichier config > Défaut script
            # Résoudre BACKUP_DIR s'il est relatif au toplevel
            if [[ "$DEFAULT_BACKUP_DIR" == .* ]]; then
                DEFAULT_BACKUP_DIR="$GIT_TOPLEVEL/${DEFAULT_BACKUP_DIR#.}" # Enlever le './'
            fi
            BACKUP_DIR=${DEFAULT_BACKUP_DIR:-${BACKUP_DIR:-"$GIT_TOPLEVEL/.git/backups"}} # Assurer un chemin absolu/relatif à la racine

            MAX_BACKUPS=${DEFAULT_MAX_BACKUPS:-${MAX_BACKUPS:-5}}
            CONFLICT_CHECK=${DEFAULT_CONFLICT_CHECK:-${CONFLICT_CHECK:-true}}
            BRANCH_CHECK=${DEFAULT_BRANCH_CHECK:-${BRANCH_CHECK:-true}}
            REMOTE_CHECK=${DEFAULT_REMOTE_CHECK:-${REMOTE_CHECK:-true}}
            DEBUG_MODE=${DEFAULT_DEBUG_MODE:-${DEBUG_MODE:-false}} # Peut être défini dans le fichier
            rm -f /tmp/push_config_stderr_$$ # Nettoyer log erreur
        else
             log_warn "Erreur lors du chargement du fichier de configuration '$config_file'. Utilisation des valeurs par défaut/actuelles."
             if [[ -s /tmp/push_config_stderr_$$ ]]; then log_warn "$(cat /tmp/push_config_stderr_$$)"; fi
             rm -f /tmp/push_config_stderr_$$
        fi
    else
         log_debug "Fichier de configuration '$config_file' non trouvé. Utilisation des valeurs par défaut/actuelles."
         # Assurer que les variables ont au moins les valeurs par défaut initiales (chemins absolus)
         BACKUP_DIR=${BACKUP_DIR:-"$GIT_TOPLEVEL/.git/backups"}
         MAX_BACKUPS=${MAX_BACKUPS:-5}
         CONFLICT_CHECK=${CONFLICT_CHECK:-true}
         BRANCH_CHECK=${BRANCH_CHECK:-true}
         REMOTE_CHECK=${REMOTE_CHECK:-true}
         # DEBUG_MODE reste à sa valeur actuelle
    fi
     log_debug "Configuration après chargement: BACKUP_DIR='$BACKUP_DIR', MAX_BACKUPS='$MAX_BACKUPS', CONFLICT_CHECK='$CONFLICT_CHECK', BRANCH_CHECK='$BRANCH_CHECK', REMOTE_CHECK='$REMOTE_CHECK', DEBUG_MODE='$DEBUG_MODE'"
}

# Sauvegarder la configuration dans un fichier (chemin absolu)
save_config() {
    local config_file=$1
    log_debug "Sauvegarde de la configuration dans '$config_file'..."
    # Sauvegarder les chemins relatifs à la racine si possible pour portabilité
    local saved_backup_dir=$BACKUP_DIR
    if [[ "$saved_backup_dir" == "$GIT_TOPLEVEL"* ]]; then
        saved_backup_dir=".${saved_backup_dir#$GIT_TOPLEVEL}" # Rendre relatif au toplevel
    fi

    cat > "$config_file" << EOF
# Configuration sauvegardée le $(date)
# Chemins relatifs à la racine du projet si possible
DEFAULT_BRANCH="$DEFAULT_BRANCH"
DEFAULT_REMOTE="$DEFAULT_REMOTE"
DEFAULT_BACKUP_DIR="$saved_backup_dir"
DEFAULT_MAX_BACKUPS="$MAX_BACKUPS"
DEFAULT_CONFLICT_CHECK="$CONFLICT_CHECK"
DEFAULT_BRANCH_CHECK="$BRANCH_CHECK"
DEFAULT_REMOTE_CHECK="$REMOTE_CHECK"
DEFAULT_DEBUG_MODE="$DEBUG_MODE"
EOF
    log_success "Configuration sauvegardée dans $config_file"
}

# Configurer interactivement les options
configure_interactive() {
    log_info "📝 Configuration interactive"

    # Variables locales pour la fonction
    local input_config_file input_branch input_remote input_backup_dir
    local input_max_backups input_conflict input_branch_check input_remote_check
    local current_branch_default current_remote_default current_backup_dir_default
    local current_max_backups_default current_conflict_check_default
    local current_branch_check_default current_remote_check_default
    local conflict_check_prompt branch_check_prompt remote_check_prompt

    # Demander le fichier de configuration (chemin absolu)
    read -p "Fichier de configuration [${CONFIG_FILE}] : " input_config_file
    CONFIG_FILE=${input_config_file:-$CONFIG_FILE} # Garder chemin absolu/défaut
    log_debug "Utilisation du fichier de configuration: $CONFIG_FILE"

    # Initialiser les valeurs par défaut *avant* de charger un fichier potentiellement incomplet
    current_branch_default="master"
    current_remote_default="origin"
    current_backup_dir_default=".git/backups" # Relatif au toplevel
    current_max_backups_default="5"
    current_conflict_check_default="true"
    current_branch_check_default="true"
    current_remote_check_default="true"

    # Charger la configuration existante (si elle existe) pour pré-remplir
    if [ -f "$CONFIG_FILE" ]; then
        log_info "Chargement de la configuration existante depuis '$CONFIG_FILE'..."
        . "$CONFIG_FILE" # Source le fichier
        # Mettre à jour les défauts pour les prompts avec les valeurs chargées
        current_branch_default=${DEFAULT_BRANCH:-$current_branch_default}
        current_remote_default=${DEFAULT_REMOTE:-$current_remote_default}
        # Garder le chemin de backup tel quel du fichier pour le prompt
        current_backup_dir_default=${DEFAULT_BACKUP_DIR:-$current_backup_dir_default}
        current_max_backups_default=${DEFAULT_MAX_BACKUPS:-$current_max_backups_default}
        current_conflict_check_default=${DEFAULT_CONFLICT_CHECK:-$current_conflict_check_default}
        current_branch_check_default=${DEFAULT_BRANCH_CHECK:-$current_branch_check_default}
        current_remote_check_default=${DEFAULT_REMOTE_CHECK:-$current_remote_check_default}
    else
        log_warn "Création d'une nouvelle configuration '$CONFIG_FILE'..."
    fi

    # Préparer les prompts o/n basé sur les valeurs actuelles/chargées
    conflict_check_prompt=$( [[ "$current_conflict_check_default" == "true" ]] && echo "o" || echo "n" )
    branch_check_prompt=$( [[ "$current_branch_check_default" == "true" ]] && echo "o" || echo "n" )
    remote_check_prompt=$( [[ "$current_remote_check_default" == "true" ]] && echo "o" || echo "n" )

    # --- Prompts Utilisateur ---
    read -p "Branche par défaut [$current_branch_default] : " input_branch
    DEFAULT_BRANCH=${input_branch:-$current_branch_default} # Sauvegardé pour info

    read -p "Remote par défaut [$current_remote_default] : " input_remote
    DEFAULT_REMOTE=${input_remote:-$current_remote_default} # Sauvegardé pour info

    read -p "Répertoire de backup (relatif à la racine: '$GIT_TOPLEVEL') [$current_backup_dir_default] : " input_backup_dir
    # Mettre à jour la variable *globale* directement ici
    BACKUP_DIR=${input_backup_dir:-$current_backup_dir_default}
    # Résoudre immédiatement en chemin absolu ou relatif à la racine pour usage interne
    if [[ "$BACKUP_DIR" == .* ]]; then
         BACKUP_DIR="$GIT_TOPLEVEL/${BACKUP_DIR#.}" # Enlever le './'
    elif [[ "$BACKUP_DIR" != /* ]]; then
         BACKUP_DIR="$GIT_TOPLEVEL/$BACKUP_DIR" # Rendre absolu si juste un nom
    fi
    log_debug "Chemin backup interne mis à jour: $BACKUP_DIR"


    read -p "Nombre maximum de backups [$current_max_backups_default] : " input_max_backups
    input_max_backups=${input_max_backups:-$current_max_backups_default}
    if ! [[ "$input_max_backups" =~ ^[0-9]+$ ]]; then
        log_error "Le nombre de backups doit être un nombre entier. Utilisation de la valeur précédente: $current_max_backups_default"
        MAX_BACKUPS=$current_max_backups_default # Garder la valeur précédente valide
    else
        MAX_BACKUPS=$input_max_backups
    fi

    read -p "Vérifier les conflits ? (o/n) [$conflict_check_prompt] : " input_conflict
    input_conflict=${input_conflict:-$conflict_check_prompt}
    [[ "$input_conflict" =~ ^[oOyY]$ ]] && CONFLICT_CHECK="true" || CONFLICT_CHECK="false"

    read -p "Vérifier les branches ? (o/n) [$branch_check_prompt] : " input_branch_check
    input_branch_check=${input_branch_check:-$branch_check_prompt}
    [[ "$input_branch_check" =~ ^[oOyY]$ ]] && BRANCH_CHECK="true" || BRANCH_CHECK="false"

    read -p "Vérifier les remotes ? (o/n) [$remote_check_prompt] : " input_remote_check
    input_remote_check=${input_remote_check:-$remote_check_prompt}
    [[ "$input_remote_check" =~ ^[oOyY]$ ]] && REMOTE_CHECK="true" || REMOTE_CHECK="false"
    # --- Fin Prompts ---

    # Sauvegarder la configuration mise à jour
    save_config "$CONFIG_FILE"
}

# Afficher la configuration actuelle
show_config() {
    # Charger la config pour s'assurer d'afficher les bonnes valeurs
    load_config "$CONFIG_FILE" # Charge et résout les chemins
    log_info "📋 Configuration actuelle :"
    log_info "   Fichier de configuration : ${CONFIG_FILE}"
    log_info "   Branche par défaut (pour interactif) : ${DEFAULT_BRANCH:-master}"
    log_info "   Remote par défaut (pour interactif) : ${DEFAULT_REMOTE:-origin}"
    # Afficher chemin backup résolu (peut être absolu ou relatif ./)
    local display_backup_dir=$BACKUP_DIR
     if [[ "$display_backup_dir" == "$GIT_TOPLEVEL"* ]]; then
        display_backup_dir=".${display_backup_dir#$GIT_TOPLEVEL}" # Afficher relatif si possible
    fi
    log_info "   Répertoire de backup : ${display_backup_dir} (Absolu: ${BACKUP_DIR})"
    log_info "   Nombre maximum de backups : ${MAX_BACKUPS}"
    log_info "   Vérification des conflits : ${CONFLICT_CHECK}"
    log_info "   Vérification des branches : ${BRANCH_CHECK}"
    log_info "   Vérification des remotes : ${REMOTE_CHECK}"
    log_info "   Mode Debug : ${DEBUG_MODE}"
}

# Afficher l'aide
show_help() {
    # Charger la config pour afficher les bonnes valeurs par défaut dans l'aide
    load_config "$CONFIG_FILE"
    local display_backup_dir=$BACKUP_DIR # Utiliser chemin résolu
     if [[ "$display_backup_dir" == "$GIT_TOPLEVEL"* ]]; then
        display_backup_dir=".${display_backup_dir#$GIT_TOPLEVEL}" # Afficher relatif si possible
    fi
    local display_config_file=$CONFIG_FILE
     if [[ "$display_config_file" == "$GIT_TOPLEVEL"* ]]; then
        display_config_file=".${display_config_file#$GIT_TOPLEVEL}" # Afficher relatif si possible
    fi

    echo "Usage: $0 [options]"
    echo "Options:"
    echo "  -h, --help              Affiche cette aide"
    echo "  -d, --debug             Active le mode debug (plus de logs)"
    echo "  -c, --config=FILE       Utilise le fichier de configuration spécifié (défaut: ${display_config_file})"
    echo "  -i, --interactive       Configure ou modifie le fichier de configuration"
    echo "  -S, --show-config       Affiche la configuration actuelle"
    echo "  -a, --all               Pousse tous les changements (sous-modules + principal)"
    echo "  -m, --main              Pousse uniquement le projet principal"
    echo "  -s, --submodules        Pousse uniquement les sous-modules"
    echo "  -n, --no-confirm        Ne demande pas de confirmation"
    echo "  --submodule=NAME_OR_PATH Pousse uniquement le sous-module spécifié"
    echo "  --submodules=LIST       Pousse les sous-modules spécifiés (séparés par ',', nom ou chemin)"
    echo "  --timeout=SECONDS       Délai d'attente pour opérations Git (défaut: ${DEFAULT_TIMEOUT})"
    echo "  --no-backup             Désactive la création de backup (ignore MAX_BACKUPS=0)"
    echo "  --no-conflict-check     Désactive la vérification des conflits (Actif par défaut: ${CONFLICT_CHECK})"
    echo "  --no-branch-check       Désactive la vérification des branches (Actif par défaut: ${BRANCH_CHECK})"
    echo "  --no-remote-check       Désactive la vérification des remotes (Actif par défaut: ${REMOTE_CHECK})"
    echo "  --backup-dir=DIR        Répertoire de backup (relatif à la racine du projet) (Défaut actuel: ${display_backup_dir})"
    echo "  --max-backups=N         Nombre maximum de backups (Défaut actuel: ${MAX_BACKUPS})"
    echo "  --branch=NAME           Spécifie la branche à pousser (Défaut actuel: ${SPECIFIED_BRANCH:-$DEFAULT_BRANCH})"
    echo "  --remote=NAME           Spécifie le remote à utiliser (Défaut actuel: ${SPECIFIED_REMOTE:-$DEFAULT_REMOTE})"
    echo ""
    echo "Exemples:"
    echo "  $0 -d -a                # Pousse tout avec logs de debug"
    echo "  $0 -c ./my_config.cfg   # Utilise ./my_config.cfg (sera résolu en chemin absolu)"
    echo "  $0 -i                   # Configure interactivement"
    echo "  $0 -S                   # Affiche la configuration"
    echo "  $0 -a                   # Pousse tout avec confirmation"
    echo "  $0 -m -n                # Pousse le principal sans confirmation"
    echo "  $0 --submodule=module1  # Pousse uniquement module1"
    echo "  $0 --submodules=mod1,path/to/mod2 # Pousse mod1 et mod2"
    echo "  $0 --branch=develop     # Pousse sur la branche develop"
    echo "  $0 --remote=upstream    # Pousse vers le remote upstream"
}

# Gérer les erreurs et quitter
handle_error() {
    local message=$1
    local code=${2:-1}
    log_error "$message"
    # Tenter de libérer le verrou avant de quitter
    release_lock
    exit $code
}

# Vérifier les prérequis (Git, dépôt valide, sous-modules)
check_prerequisites() {
    log_debug "Vérification des prérequis..."
    # Git installé?
    if ! command -v git &> /dev/null; then
        handle_error "Git n'est pas installé."
    fi
    log_debug "Git est installé."

    # Dans un dépôt Git? Déjà vérifié par set_git_toplevel
    log_debug "Est dans un dépôt Git (vérifié par set_git_toplevel)."

    # Sous-modules initialisés? (si .gitmodules existe)
    if [ -f .gitmodules ]; then # Vérifier existence à la racine
         log_debug "Fichier .gitmodules trouvé. Vérification de l'initialisation des sous-modules..."
         # Exécuter depuis la racine (où nous sommes)
         if ! git submodule status --recursive > /dev/null 2>&1; then
            # Vérifier l'erreur spécifique "not initialized"
            if git submodule status --recursive 2>&1 | grep -q "not initialized"; then
                log_warn "Les sous-modules ne sont pas initialisés."
                read -p "Voulez-vous les initialiser (git submodule update --init --recursive) ? (o/n) " -n 1 -r REPLY
                echo
                if [[ $REPLY =~ ^[YyOo]$ ]]; then
                    log_info "🔄 Initialisation des sous-modules..."
                    # Exécuter depuis la racine
                    if git submodule update --init --recursive; then
                         log_success "Sous-modules initialisés."
                    else
                         handle_error "Échec de l'initialisation des sous-modules."
                    fi
                fi
             else
                 log_warn "Impossible de vérifier le statut des sous-modules (erreur autre que non initialisé)."
             fi
         else
              log_debug "Sous-modules déjà initialisés ou statut OK."
         fi
    else
         log_debug "Aucun fichier .gitmodules trouvé à la racine."
    fi
    log_debug "Vérification des prérequis terminée."
}

# Acquérir un verrou pour éviter exécution multiple
acquire_lock() {
    log_debug "Tentative d'acquisition du verrou: $LOCK_FILE"
    # Vérifier existence du répertoire du verrou
     if [ ! -d "$(dirname "$LOCK_FILE")" ]; then
        handle_error "Le répertoire pour le fichier de verrouillage ('$(dirname "$LOCK_FILE")') n'existe pas."
    fi

    # Vérifier si le verrou existe et si le processus est actif
    if [ -e "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if [[ "$pid" =~ ^[0-9]+$ ]] && ps -p "$pid" > /dev/null; then
            handle_error "Une autre instance du script est en cours d'exécution (PID: $pid). Verrou: $LOCK_FILE"
        else
             log_warn "Ancien fichier de verrouillage trouvé ($LOCK_FILE), processus inactif ou invalide. Suppression..."
            if ! rm -f "$LOCK_FILE"; then
                 handle_error "Impossible de supprimer l'ancien fichier de verrouillage: $LOCK_FILE. Vérifiez les permissions."
            fi
        fi
    fi
    # Créer le fichier de verrouillage avec le PID actuel
    if echo $$ > "$LOCK_FILE"; then
         log_debug "Verrou acquis (PID: $$)."
    else
         handle_error "Impossible de créer le fichier de verrouillage: $LOCK_FILE."
    fi
}

# Libérer le verrou
release_lock() {
    if [ -f "$LOCK_FILE" ] && [[ "$(cat "$LOCK_FILE" 2>/dev/null)" == "$$" ]]; then
        log_debug "Libération du verrou: $LOCK_FILE"
        rm -f "$LOCK_FILE"
    elif [ -f "$LOCK_FILE" ]; then
         log_debug "Verrou non libéré (appartient à un autre PID ou erreur de lecture)."
    else
         log_debug "Aucun verrou à libérer ($LOCK_FILE non trouvé)."
    fi
}

# Nettoyer (libérer verrou) avant de quitter
cleanup() {
    local exit_status=$?
    log_debug "Nettoyage avant sortie (Statut: $exit_status)..."
    release_lock
    log_debug "Nettoyage terminé."
}

# Afficher un résumé des changements (avant confirmation)
# Utilise git -C "$repo_path"
show_summary() {
    local context=$1   # Nom pour affichage (e.g., "projet principal")
    local repo_path=$2 # Chemin relatif depuis toplevel (".", "path/to/sub")
    local added modified deleted untracked staged_summary unstaged_summary unstaged

    log_debug "Préparation du résumé pour '$context' dans '$repo_path'..."

    # Vérifier rapidement s'il y a des changements (évite les messages si clean)
    # Exécute git status depuis la racine en ciblant le repo_path
    if ! git -C "$repo_path" status --porcelain | grep -q .; then
         log_info "Aucun changement détecté dans '$context' ('$repo_path')."
         return 0
    fi

    # --- Affichage du Résumé (Visible car avant confirmation) ---
    log_info ""
    log_info "📊 Résumé des changements dans '$context' ('$repo_path'):"

    # Récupérer détails des changements indexés (staged) avec git -C
    added=$(git -C "$repo_path" diff --cached --name-only --diff-filter=A 2>/dev/null)
    modified=$(git -C "$repo_path" diff --cached --name-only --diff-filter=M 2>/dev/null)
    deleted=$(git -C "$repo_path" diff --cached --name-only --diff-filter=D 2>/dev/null)
    staged_summary=$(git -C "$repo_path" diff --cached --shortstat 2>/dev/null || echo "Aucun changement indexé")

    if [[ -n "$added" || -n "$modified" || -n "$deleted" ]]; then
         log_info "   --- Changements Indexés (pour commit) ---"
         if [[ -n "$added" ]]; then log_info "   Ajoutés :"; printf "     - %s\n" $added; fi
         if [[ -n "$modified" ]]; then log_info "   Modifiés :"; printf "     - %s\n" $modified; fi
         if [[ -n "$deleted" ]]; then log_info "   Supprimés :"; printf "     - %s\n" $deleted; fi
        log_info "   Résumé Indexés : $staged_summary"
    else
         log_info "   Aucun changement indexé (stagé)."
    fi

    # Récupérer détails des changements non indexés (unstaged) avec git -C
    log_info "   --- Changements Non Indexés (seront ajoutés par 'git add .') ---"
    untracked=$(git -C "$repo_path" ls-files --others --exclude-standard)
    unstaged=$(git -C "$repo_path" status --porcelain | grep '^ M\|^ D\|^ A' | cut -c 4-) # Fichiers suivis modifiés/supprimés
    unstaged_summary=$(git -C "$repo_path" diff --shortstat 2>/dev/null || echo "Aucun changement non indexé")

    if [[ -n "$untracked" ]]; then log_info "   Fichiers Non Suivis:"; printf "     - %s\n" $untracked; fi
    if [[ -n "$unstaged" ]]; then log_info "   Modifiés/Supprimés (non indexés):"; printf "     - %s\n" $unstaged; fi
    if [[ -z "$untracked" && -z "$unstaged" ]]; then
         log_info "   Aucun changement non indexé ou non suivi."
    else
         log_info "   Résumé Non Indexés : $unstaged_summary"
    fi
    # --- Fin Affichage Résumé ---

    log_debug "Résumé pour '$context' ('$repo_path') terminé."
    return 0
}

# Demander confirmation à l'utilisateur
ask_confirmation() {
    local context=$1 # Nom pour affichage
    if [[ "$NO_CONFIRM" == "true" ]]; then
        log_debug "Confirmation automatique (--no-confirm) pour '$context'."
        return 0
    fi
    while true; do
        read -p "Valider le commit et push de '$context' ? (o/n) : " confirm
        if [[ "$confirm" =~ ^[oOyY]$ ]]; then log_debug "Confirmation reçue pour '$context'."; return 0; fi
        if [[ "$confirm" =~ ^[nN]$ ]]; then log_debug "Refus de confirmation pour '$context'."; return 1; fi
        log_warn "Réponse invalide. Veuillez entrer 'o' pour oui ou 'n' pour non."
    done
}


# Créer un backup du répertoire spécifié (utilise chemin absolu pour tar)
create_backup() {
    local source_path_relative=$1 # Chemin relatif depuis toplevel (".", "path/to/sub")
    local repo_name=$2            # Nom pour préfixe fichier backup
    local resolved_source_path target_backup_subdir timestamp safe_repo_name
    local backup_filename full_backup_path tar_options relative_backup_exclude
    local backup_files_to_delete file_to_delete tar_stderr_file

    if [[ "$NO_BACKUP" == "true" ]] || [[ "$MAX_BACKUPS" -le 0 ]]; then
        log_info "ℹ️  Création de backup désactivée pour '$repo_name'."
        return 0
    fi
    log_debug "Début création backup pour '$repo_name' depuis '$source_path_relative'..."

    # Construire chemin absolu pour tar -C et realpath
    # $GIT_TOPLEVEL est la base, source_path_relative est le chemin depuis là
    resolved_source_path="$GIT_TOPLEVEL/$source_path_relative"
    # Utiliser realpath pour nettoyer (ex: //, /./) mais autoriser non-existence finale (-m)
    # Ceci est surtout pour la robustesse, même si on est déjà à la racine.
    resolved_source_path=$(realpath -m "$resolved_source_path")

    if [[ -z "$resolved_source_path" ]] || [[ ! -d "$resolved_source_path" ]]; then
         log_error "Chemin source invalide pour backup: '$source_path_relative' -> '$resolved_source_path'. Backup annulé."
         return 1
    fi
    log_debug "Chemin source absolu pour backup tar: '$resolved_source_path'"

    # $BACKUP_DIR est déjà absolu ou relatif à la racine après config load/interactive
    # Assurer qu'il est absolu pour mkdir et find
    local absolute_backup_dir
    if [[ "$BACKUP_DIR" == .* ]]; then
        absolute_backup_dir="$GIT_TOPLEVEL/${BACKUP_DIR#.}"
    elif [[ "$BACKUP_DIR" != /* ]]; then
         absolute_backup_dir="$GIT_TOPLEVEL/$BACKUP_DIR"
    else
         absolute_backup_dir="$BACKUP_DIR"
    fi
     log_debug "Répertoire de backup absolu: '$absolute_backup_dir'"


    # Créer sous-répertoire spécifique au repo
    target_backup_subdir="$absolute_backup_dir/$repo_name"
    log_debug "Création du répertoire de backup spécifique: '$target_backup_subdir'..."
    if ! mkdir -p "$target_backup_subdir"; then
         log_error "Impossible de créer le répertoire de backup: '$target_backup_subdir'. Backup annulé."
         return 1;
    fi

    # Nom du fichier backup
    timestamp=$(date +%Y%m%d_%H%M%S)
    safe_repo_name=$(echo "$repo_name" | sed 's|/|_|g')
    backup_filename="${safe_repo_name}_${timestamp}.tar.gz"
    full_backup_path="$target_backup_subdir/$backup_filename"

    log_info "📦 Création du backup de '$repo_name' vers '$full_backup_path'..."

    # Options Tar: exclure .git et le répertoire de backup lui-même
    tar_options=(-czf "$full_backup_path" --exclude=".git")
    # Tenter d'exclure le chemin relatif du backup dir si possible depuis la source
    relative_backup_exclude=$(realpath --relative-to="$resolved_source_path" "$absolute_backup_dir" 2>/dev/null)
    if [[ -n "$relative_backup_exclude" ]]; then
         log_debug "Exclusion Tar relative du répertoire de backup: '$relative_backup_exclude'"
         tar_options+=("--exclude=$relative_backup_exclude")
    elif [[ "$absolute_backup_dir" == "$resolved_source_path"* ]]; then
         local backup_dir_name=$(basename "$absolute_backup_dir")
         log_debug "Exclusion Tar simple du répertoire de backup (contenu dans source): '$backup_dir_name'"
         tar_options+=("--exclude=$backup_dir_name")
    else
          log_debug "Le répertoire de backup '$absolute_backup_dir' est hors de la source '$resolved_source_path', pas d'exclusion Tar spécifique."
    fi
    log_debug "Options Tar: ${tar_options[*]}"
    log_debug "Commande Tar: tar ${tar_options[*]} -C '$resolved_source_path' ."

    # Exécuter Tar, capturer stderr
    tar_stderr_file="/tmp/push_tar_stderr_$$"
    if ! tar "${tar_options[@]}" -C "$resolved_source_path" . 2> "$tar_stderr_file"; then
         log_warn "Impossible de créer le backup '$full_backup_path'. Vérifiez permissions/espace disque. Continuation sans backup."
         if [[ -s "$tar_stderr_file" ]]; then log_debug "Erreur Tar:\n$(cat "$tar_stderr_file")"; fi
         rm -f "$full_backup_path" "$tar_stderr_file"
         return 0
    fi
    rm -f "$tar_stderr_file"
    log_debug "Backup Tar créé avec succès: $full_backup_path"

    # Nettoyer anciens backups (utiliser chemin absolu pour find)
    log_debug "Recherche anciens backups (> $MAX_BACKUPS) dans '$target_backup_subdir'..."
    backup_files_to_delete=$(find "$target_backup_subdir" -maxdepth 1 -name "${safe_repo_name}_*.tar.gz" -type f -printf '%T@ %p\n' | sort -nr | tail -n +$(($MAX_BACKUPS + 1)) | cut -d' ' -f2-)

    if [[ -n "$backup_files_to_delete" ]]; then
        log_debug "Nettoyage des anciens backups (> $MAX_BACKUPS)..."
        echo "$backup_files_to_delete" | while IFS= read -r file_to_delete; do
             if [[ -n "$file_to_delete" ]]; then
                log_debug "  Suppression: $file_to_delete"
                if ! rm -f "$file_to_delete"; then log_warn "Impossible de supprimer '$file_to_delete'."; fi
            fi
        done
        log_debug "Nettoyage anciens backups terminé."
    else
         log_debug "Aucun ancien backup à nettoyer."
    fi

    return 0
}

# Vérifier conflits Git (utilise git -C)
check_conflicts() {
    local repo_path=$1 # Chemin relatif depuis toplevel
    local repo_name=$2
    local conflicts

    if [[ "$CONFLICT_CHECK" == "false" ]]; then
        log_info "ℹ️  Vérification des conflits désactivée pour '$repo_name'."
        return 0
    fi
    log_debug "Vérification des conflits dans '$repo_name' ('$repo_path')..."
    # Exécuter git status dans le bon répertoire sans cd
    conflicts=$(git -C "$repo_path" status --porcelain | grep '^UU')

    if [[ -n "$conflicts" ]]; then
        log_error "Conflits détectés dans '$repo_name' ('$repo_path'):"
        printf "    %s\n" "$conflicts"
        # Pas besoin de cd -
        handle_error "Résolvez les conflits dans '$repo_name' avant de pousser."
    fi

    log_debug "Aucun conflit détecté dans '$repo_name' ('$repo_path')."
    return 0
}

# Vérifier si la branche actuelle correspond (utilise git -C)
check_branch() {
    local repo_path=$1 # Chemin relatif depuis toplevel
    local repo_name=$2
    local current_branch

    if [[ "$BRANCH_CHECK" == "false" ]] || [[ -z "$SPECIFIED_BRANCH" ]]; then
        if [[ "$BRANCH_CHECK" == "false" ]]; then 
            log_info "ℹ️  Vérification branche désactivée pour '$repo_name'."; 
        else 
            log_debug "Aucune branche spécifiée, vérification ignorée pour '$repo_name'."; 
        fi
        return 0
    fi

    log_debug "Vérification branche dans '$repo_name' ('$repo_path') (doit être '$SPECIFIED_BRANCH')..."
    current_branch=$(git -C "$repo_path" rev-parse --abbrev-ref HEAD 2>/dev/null)

    if [[ -z "$current_branch" ]]; then
         log_error "Impossible de déterminer la branche actuelle dans '$repo_name' ('$repo_path'). Vérification ignorée."
         return 1 # Indiquer échec
    fi
     log_debug "Branche actuelle dans '$repo_name': '$current_branch'."

    if [[ "$current_branch" != "$SPECIFIED_BRANCH" ]]; then
         # Pas besoin de cd -
         handle_error "Branche actuelle ('$current_branch') dans '$repo_name' != branche spécifiée ('$SPECIFIED_BRANCH')."
    fi

    log_debug "Branche vérifiée dans '$repo_name': '$current_branch'."
    return 0
}

# Vérifier si le remote correspond (utilise git -C)
check_remote() {
    local repo_path=$1 # Chemin relatif depuis toplevel
    local repo_name=$2
    local current_branch configured_remote

    if [[ "$REMOTE_CHECK" == "false" ]] || [[ -z "$SPECIFIED_REMOTE" ]]; then
         if [[ "$REMOTE_CHECK" == "false" ]]; then 
            log_info "ℹ️  Vérification remote désactivée pour '$repo_name'."; 
         else 
            log_debug "Aucun remote spécifié, vérification ignorée pour '$repo_name'."; 
         fi
        return 0
    fi

    log_debug "Vérification remote dans '$repo_name' ('$repo_path') (doit être '$SPECIFIED_REMOTE')..."
    current_branch=$(git -C "$repo_path" rev-parse --abbrev-ref HEAD 2>/dev/null)

     if [[ -z "$current_branch" ]]; then
         log_error "Impossible de déterminer la branche actuelle dans '$repo_name' ('$repo_path') pour vérifier remote."
         return 1
    fi
     log_debug "Branche actuelle pour remote check: '$current_branch'."

    # Vérifier existence remote spécifié
    log_debug "Vérification existence remote '$SPECIFIED_REMOTE'..."
    if ! git -C "$repo_path" remote | grep -q "^${SPECIFIED_REMOTE}$"; then
         # Pas besoin de cd -
         handle_error "Remote spécifié '$SPECIFIED_REMOTE' n'existe pas dans '$repo_name' ('$repo_path')."
    fi
     log_debug "Remote '$SPECIFIED_REMOTE' existe."

    # Vérifier remote configuré pour la branche
    log_debug "Vérification remote configuré pour branche '$current_branch'..."
    configured_remote=$(git -C "$repo_path" config branch.$current_branch.remote 2>/dev/null)

    if [[ -z "$configured_remote" ]]; then
         log_warn "Aucun remote configuré pour branche '$current_branch' dans '$repo_name'. Push utilisera '$SPECIFIED_REMOTE'."
         # Optionnel: git -C "$repo_path" branch --set-upstream-to="$SPECIFIED_REMOTE/$current_branch" "$current_branch"
    elif [[ "$configured_remote" != "$SPECIFIED_REMOTE" ]]; then
        # Pas besoin de cd -
        handle_error "Remote configuré ('$configured_remote') pour branche '$current_branch' dans '$repo_name' != remote spécifié ('$SPECIFIED_REMOTE')."
    else
         log_debug "Remote configuré ('$configured_remote') correspond au remote demandé ('$SPECIFIED_REMOTE')."
    fi

    log_debug "Remote vérifié dans '$repo_name': '$SPECIFIED_REMOTE' sera utilisé."
    return 0
}

# Commiter les changements (utilise git -C)
commit_changes() {
    local context=$1   # Pour message commit
    local repo_name=$2 # Pour logs
    local repo_path=$3 # Chemin relatif depuis toplevel
    local commit_msg staged_summary git_add_stderr git_commit_stderr add_cmd add_status commit_cmd commit_status

    log_info "📝 Préparation du commit pour '$repo_name' ('$repo_path')..."

    log_debug "Ajout de tous les changements (git add .) dans '$repo_path'..."
    git_add_stderr="/tmp/push_git_add_stderr_$$"
    add_cmd=(git -C "$repo_path" add .) # Utiliser -C
    add_status=0

    if [[ -n "$TIMEOUT_CMD" ]]; then
        $TIMEOUT_CMD "$TIMEOUT" "${add_cmd[@]}" 2> "$git_add_stderr" || add_status=$?
    else
        "${add_cmd[@]}" 2> "$git_add_stderr" || add_status=$?
    fi

    if [[ $add_status -ne 0 ]]; then
         if [[ -s "$git_add_stderr" ]]; then log_debug "Erreur git add:\n$(cat "$git_add_stderr")"; fi
         rm -f "$git_add_stderr"
         # Pas besoin de cd -
         handle_error "Timeout ou erreur ($add_status) lors de l'ajout des fichiers (git add .) pour '$repo_name'"
    fi
    rm -f "$git_add_stderr"
    log_debug "Ajout des fichiers terminé (git add .)."

    # Vérifier changements indexés avec git -C
    log_debug "Vérification des changements indexés pour commit dans '$repo_path'..."
    if git -C "$repo_path" diff --cached --quiet --exit-code; then
        log_info "Aucun changement à commiter dans '$repo_name'."
        # Pas besoin de cd -
        return 0
    fi

    # Générer message de commit
    log_debug "Changements indexés détectés. Génération message commit..."
    commit_msg="MAJ auto $context $(date +%Y-%m-%d_%H:%M:%S)"
    staged_summary=$(git -C "$repo_path" diff --cached --shortstat) # Utiliser -C
    commit_msg+="\n\nRésumé des changements indexés:\n$staged_summary"
    log_debug "Message de commit généré:\n---\n$commit_msg\n---"

    # Exécuter le commit avec git -C
    log_debug "Commit des changements indexés dans '$repo_path'..."
    git_commit_stderr="/tmp/push_git_commit_stderr_$$"
    commit_cmd=(git -C "$repo_path" commit --file=-) # Utiliser -C
    commit_status=0

    if [[ -n "$TIMEOUT_CMD" ]]; then
        echo -e "$commit_msg" | $TIMEOUT_CMD "$TIMEOUT" "${commit_cmd[@]}" 2> "$git_commit_stderr" || commit_status=$?
    else
         echo -e "$commit_msg" | "${commit_cmd[@]}" 2> "$git_commit_stderr" || commit_status=$?
    fi

    if [[ $commit_status -ne 0 ]]; then
        if [[ -s "$git_commit_stderr" ]]; then log_debug "Erreur git commit:\n$(cat "$git_commit_stderr")"; fi
         rm -f "$git_commit_stderr"
         # Pas besoin de cd -
         handle_error "Timeout ou erreur ($commit_status) lors du commit pour '$repo_name'"
    fi
    rm -f "$git_commit_stderr"
    log_success "Commit effectué dans '$repo_name'."

    # Pas besoin de cd -
    return 0
}

# Traiter un sous-module spécifique (utilise git -C)
process_submodule() {
    local name=$1           # Nom ou chemin fourni
    local path_relative=$2  # Chemin relatif depuis toplevel
    local push_branch push_remote push_cmd push_output push_error push_status push_stderr_file

    # Pas besoin de normaliser/cd, path_relative est utilisé directement avec -C

    log_debug "\n--- Début Traitement Sous-module : '$name' (Chemin: '$path_relative') ---"

    # --- Vérifications Préalables (utilisent git -C) ---
    if ! check_conflicts "$path_relative" "$name"; then return 1; fi
    if ! check_branch "$path_relative" "$name"; then return 1; fi
    if ! check_remote "$path_relative" "$name"; then return 1; fi

    # Vérifier changements avec git -C
    if ! git -C "$path_relative" status --porcelain | grep -q .; then
         log_info "Aucun changement détecté dans '$name' ('$path_relative') après vérifications."
         log_debug "--- Fin Traitement Sous-module (aucun changement) : '$name' ---"
         return 0
    fi

    # --- Changements détectés: Résumé et Confirmation ---
    show_summary "$name" "$path_relative" # Utilise git -C
    if ! ask_confirmation "$name"; then
        log_info "⏭️  Commit et Push du sous-module '$name' annulés par l'utilisateur."
        log_debug "--- Fin Traitement Sous-module (annulé par utilisateur) : '$name' ---"
        return 0 # Pas une erreur
    fi

    # --- Backup, Commit, Push ---
    create_backup "$path_relative" "$name" # Passe chemin relatif, gère résolution interne
    if ! commit_changes "(sous-module $name)" "$name" "$path_relative"; then # Utilise git -C
         log_debug "--- Fin Traitement Sous-module (erreur commit) : '$name' ---"
         return 1 # Échec commit
    fi

    # Déterminer branche/remote (variables globales)
    push_branch=$SPECIFIED_BRANCH
    push_remote=$SPECIFIED_REMOTE
    log_info "🚀 Push '$name' ('$path_relative': $push_branch) → '$push_remote'..."

    # Exécuter Push avec git -C
    push_cmd=(git -C "$path_relative" push "$push_remote" "$push_branch")
    log_debug "Exécution push: ${push_cmd[*]}"
    push_output=""
    push_error=""
    push_status=0
    push_stderr_file="/tmp/push_git_push_stderr_$$"

    if [[ -n "$TIMEOUT_CMD" ]]; then
         push_output=$($TIMEOUT_CMD "$TIMEOUT" "${push_cmd[@]}" 2> "$push_stderr_file") || push_status=$?
    else
         push_output=$("${push_cmd[@]}" 2> "$push_stderr_file") || push_status=$?
    fi

    # Analyser résultat push
    if [[ $push_status -ne 0 ]]; then
        log_debug "--- Sortie Push (stdout) '$name' --- \n$push_output\n--- Fin Sortie Push ---"
        if [[ -s "$push_stderr_file" ]]; then log_debug "--- Erreur Push (stderr) '$name' --- \n$(cat "$push_stderr_file")\n--- Fin Erreur Push ---"; fi
        rm -f "$push_stderr_file"
        # Pas besoin de cd -
        handle_error "Timeout ($TIMEOUT s) ou erreur ($push_status) lors du push de '$name' vers '$push_remote/$push_branch'."
    fi
    log_debug "--- Sortie Push (stdout) '$name' --- \n$push_output\n--- Fin Sortie Push ---"
    if [[ -s "$push_stderr_file" ]]; then log_debug "--- Sortie Push (stderr) '$name' --- \n$(cat "$push_stderr_file")\n--- Fin Erreur Push ---"; fi
    rm -f "$push_stderr_file"

    log_success "Push de '$name' ('$path_relative') terminé."
    log_debug "--- Fin Traitement Sous-module (succès) : '$name' ---"
    return 0 # Succès
}

# --- Logique Principale du Script ---

# 1. Déterminer la racine du dépôt et s'y placer
set_git_toplevel # Quitte si erreur

# 2. Installer le trap de nettoyage (après set_git_toplevel et cd)
trap cleanup EXIT INT TERM
log_debug "Trap de nettoyage installé."

# 3. Parser les arguments (les chemins seront relatifs à la racine où on est maintenant)
# Variables pour arguments (réinitialisées avant parsing)
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
NO_BACKUP_ARG=false
NO_CONFLICT_CHECK_ARG=false
NO_BRANCH_CHECK_ARG=false
NO_REMOTE_CHECK_ARG=false
BACKUP_DIR_ARG=""
MAX_BACKUPS_ARG=""
SPECIFIED_BRANCH_ARG=""
SPECIFIED_REMOTE_ARG=""
DEBUG_MODE_ARG=false

log_debug "Analyse des arguments de ligne de commande..."
TEMP=$(getopt -o hc:iSa:msnd --long help,config:,interactive,show-config,all,main,submodules,no-confirm,submodule:,submodules:,timeout:,no-backup,no-conflict-check,no-branch-check,no-remote-check,backup-dir:,max-backups:,branch:,remote:,debug -n "$0" -- "$@")
if [ $? != 0 ] ; then log_error "Erreur lors de l'analyse des options." >&2 ; show_help; exit 1 ; fi
eval set -- "$TEMP"
log_debug "Arguments après getopt: $*"

# Boucle de traitement des arguments
while true; do
  case "$1" in
    -h | --help ) show_help; exit 0 ;;
    -d | --debug ) DEBUG_MODE_ARG=true; shift ;;
    -c | --config ) CONFIG_FILE_ARG="$2"; shift 2 ;; # Sera résolu plus tard
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
    --backup-dir ) BACKUP_DIR_ARG="$2"; shift 2 ;; # Sera résolu plus tard
    --max-backups ) MAX_BACKUPS_ARG="$2"; shift 2 ;;
    --branch ) SPECIFIED_BRANCH_ARG="$2"; shift 2 ;;
    --remote ) SPECIFIED_REMOTE_ARG="$2"; shift 2 ;;
    -- ) shift; break ;;
    * ) handle_error "Erreur interne de parsing d'arguments! Argument non reconnu: $1" ;;
  esac
done
log_debug "Analyse des arguments terminée."

# 4. Appliquer Configuration (Défauts > Fichier > Arguments)
# Appliquer flag debug de l'argument en premier
if [[ "$DEBUG_MODE_ARG" == "true" ]]; then DEBUG_MODE=true; fi
log_debug "Mode Debug après argument: $DEBUG_MODE"

# Déterminer chemin fichier config (arg > défaut initial) et résoudre en absolu
if [[ -n "$CONFIG_FILE_ARG" ]]; then
    if [[ "$CONFIG_FILE_ARG" == /* ]]; then CONFIG_FILE="$CONFIG_FILE_ARG"; else CONFIG_FILE="$GIT_TOPLEVEL/$CONFIG_FILE_ARG"; fi
    log_debug "Utilisation fichier config via argument: '$CONFIG_FILE'"
fi # Sinon CONFIG_FILE a déjà été rendu absolu dans set_git_toplevel

# Charger la configuration depuis le fichier (peut surcharger DEBUG_MODE aussi)
load_config "$CONFIG_FILE"
# Réappliquer l'argument debug au cas où le fichier l'aurait désactivé
if [[ "$DEBUG_MODE_ARG" == "true" ]]; then DEBUG_MODE=true; fi
log_debug "Mode Debug après chargement config: $DEBUG_MODE"

# Gérer modes interactif ou affichage config (qui quittent après)
if [[ "$INTERACTIVE_MODE" == "true" ]]; then configure_interactive; exit 0; fi
if [[ "$SHOW_CONFIG_MODE" == "true" ]]; then show_config; exit 0; fi

# Appliquer les flags de comportement des arguments (--no-*)
if [[ "$NO_BACKUP_ARG" == "true" ]]; then NO_BACKUP=true; log_debug "Backups désactivés par argument."; fi
if [[ "$NO_CONFLICT_CHECK_ARG" == "true" ]]; then CONFLICT_CHECK=false; log_debug "Vérification conflits désactivée par argument."; fi
if [[ "$NO_BRANCH_CHECK_ARG" == "true" ]]; then BRANCH_CHECK=false; log_debug "Vérification branches désactivée par argument."; fi
if [[ "$NO_REMOTE_CHECK_ARG" == "true" ]]; then REMOTE_CHECK=false; log_debug "Vérification remotes désactivée par argument."; fi

# Appliquer les valeurs des arguments (résoudre chemins backup dir)
if [[ -n "$BACKUP_DIR_ARG" ]]; then
    BACKUP_DIR="$BACKUP_DIR_ARG"
    if [[ "$BACKUP_DIR" == .* ]]; then BACKUP_DIR="$GIT_TOPLEVEL/${BACKUP_DIR#.}"
    elif [[ "$BACKUP_DIR" != /* ]]; then BACKUP_DIR="$GIT_TOPLEVEL/$BACKUP_DIR"; fi
    log_debug "Répertoire backup défini par argument (résolu): $BACKUP_DIR"
fi
if [[ -n "$MAX_BACKUPS_ARG" ]]; then
     if ! [[ "$MAX_BACKUPS_ARG" =~ ^[0-9]+$ ]]; then handle_error "L'argument --max-backups doit être un nombre entier."; fi
     MAX_BACKUPS="$MAX_BACKUPS_ARG"; log_debug "Max backups défini par argument: $MAX_BACKUPS"
fi
if [[ -n "$SPECIFIED_BRANCH_ARG" ]]; then SPECIFIED_BRANCH="$SPECIFIED_BRANCH_ARG"; log_debug "Branche spécifiée par argument: $SPECIFIED_BRANCH"; fi
if [[ -n "$SPECIFIED_REMOTE_ARG" ]]; then SPECIFIED_REMOTE="$SPECIFIED_REMOTE_ARG"; log_debug "Remote spécifié par argument: $SPECIFIED_REMOTE"; fi
if [[ -n "$TIMEOUT_ARG" ]]; then
     if ! [[ "$TIMEOUT_ARG" =~ ^[0-9]+$ ]]; then handle_error "L'argument --timeout doit être un nombre entier."; fi
     TIMEOUT="$TIMEOUT_ARG"; log_debug "Timeout défini par argument: $TIMEOUT"
fi

# Définir branche/remote effectifs si non spécifiés par argument
DEFAULT_BRANCH=${DEFAULT_BRANCH:-master}
DEFAULT_REMOTE=${DEFAULT_REMOTE:-origin}
SPECIFIED_BRANCH=${SPECIFIED_BRANCH:-$DEFAULT_BRANCH}
SPECIFIED_REMOTE=${SPECIFIED_REMOTE:-$DEFAULT_REMOTE}
log_debug "Branche effective finale: $SPECIFIED_BRANCH"
log_debug "Remote effectif final: $SPECIFIED_REMOTE"
# --- Fin Configuration ---

# 5. Exécution Principale
log_debug "Début de l'exécution principale (après config)."

# Vérifier prérequis
check_prerequisites

# Acquérir le verrou
acquire_lock

# Déterminer action par défaut si rien n'est spécifié
if [[ "$PUSH_ALL" == "false" && "$PUSH_MAIN" == "false" && "$PUSH_SUBMODULES" == "false" && -z "$SPECIFIC_SUBMODULE" && ${#SPECIFIC_SUBMODULES[@]} -eq 0 ]]; then
    log_info "ℹ️  Aucune action spécifiée (-a, -m, -s, --submodule), utilisation de --all par défaut."
    PUSH_ALL=true
fi

# Traiter les sous-modules si demandé
if [[ "$PUSH_ALL" == "true" || "$PUSH_SUBMODULES" == "true" || -n "$SPECIFIC_SUBMODULE" || ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
    log_debug "\n--- Début Traitement global des Sous-modules ---"
    log_debug "Récupération liste des sous-modules (git submodule status)..."
    submodule_list=$(git submodule status --recursive | awk '{print $2}') # Chemins relatifs à la racine

    if [[ -z "$submodule_list" ]]; then
         log_info "ℹ️  Aucun sous-module trouvé ou enregistré."
    else
        log_debug "Liste des chemins de sous-modules trouvés:\n$submodule_list"
        processed_any_submodule=false
        # Itérer sur chaque chemin de sous-module
        # ATTENTION: Pas de 'local' ici car pas directement dans une fonction
        sub_path=""
        sub_name=""
        process_this=""
        requested_sub=""
        echo "$submodule_list" | while IFS= read -r sub_path; do
            # Obtenir nom depuis chemin
            sub_name=$(basename "$sub_path")
            # Nettoyer espaces
            sub_path=$(echo "$sub_path" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            sub_name=$(echo "$sub_name" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
            log_debug "Analyse du sous-module: Nom='$sub_name', Chemin='$sub_path'"

             # Déterminer si ce sous-module doit être traité
            process_this=false # Réinitialiser pour chaque itération
            if [[ "$PUSH_ALL" == "true" ]] || [[ "$PUSH_SUBMODULES" == "true" ]]; then
                process_this=true
                log_debug "Traitement de '$sub_name' (cause: --all ou --submodules)."
            elif [[ -n "$SPECIFIC_SUBMODULE" ]] && { [[ "$sub_name" == "$SPECIFIC_SUBMODULE" ]] || [[ "$sub_path" == "$SPECIFIC_SUBMODULE" ]]; }; then
                 process_this=true
                 log_debug "Traitement de '$sub_name' (cause: --submodule=$SPECIFIC_SUBMODULE correspond)."
            elif [[ ${#SPECIFIC_SUBMODULES[@]} -gt 0 ]]; then
                 # Pas de 'local' ici
                 for requested_sub in "${SPECIFIC_SUBMODULES[@]}"; do
                     if [[ "$sub_name" == "$requested_sub" ]] || [[ "$sub_path" == "$requested_sub" ]]; then
                         process_this=true
                         log_debug "Traitement de '$sub_name' (cause: --submodules=$requested_sub correspond)."
                         break
                     fi
                 done
            fi

            # Traiter si nécessaire
            if [[ "$process_this" == "true" ]]; then
                processed_any_submodule=true
                # Passer nom et chemin relatif
                process_submodule "$sub_name" "$sub_path"
                # process_submodule gère erreurs fatales
            else
                 log_debug "Ignoré: '$sub_name' ('$sub_path') ne correspond pas aux critères."
            fi
        done # Fin boucle while

        if [[ "$processed_any_submodule" == "false" ]]; then
            log_info "ℹ️  Aucun sous-module trouvé ne correspond aux critères spécifiés (${SPECIFIC_SUBMODULE:-}${SPECIFIC_SUBMODULES[*]:+ , ${SPECIFIC_SUBMODULES[*]}})."
        fi
    fi
     log_debug "--- Fin Traitement global des Sous-modules ---"
fi


# Traiter le projet principal si demandé
if [[ "$PUSH_ALL" == "true" || "$PUSH_MAIN" == "true" ]]; then
    log_debug "\n--- Début Traitement du Projet Principal (.) ---"
    # Variables locales pour cette section
    push_branch="" push_remote="" push_cmd=() push_output="" push_error="" push_status=0 push_stderr_file=""

     # --- Vérifications Préalables (pour ".") ---
    if ! check_conflicts "." "projet principal"; then exit 1; fi
    if ! check_branch "." "projet principal"; then exit 1; fi
    if ! check_remote "." "projet principal"; then exit 1; fi

    # Vérifier changements
    if ! git -C "." status --porcelain | grep -q .; then
         log_info "Aucun changement détecté dans le projet principal après vérifications."
    else
         # --- Changements détectés: Résumé et Confirmation ---
        show_summary "projet principal" "."
        if ! ask_confirmation "projet principal"; then
            log_info "⏭️  Commit et Push du projet principal annulés par l'utilisateur."
        else
             # --- Backup, Commit, Push (pour ".") ---
            create_backup "." "principal"
            if ! commit_changes "(projet principal)" "principal" "."; then
                 log_debug "--- Fin Traitement Projet Principal (erreur commit) ---"
                 exit 1
            fi

            # Déterminer branche/remote
            push_branch=$SPECIFIED_BRANCH
            push_remote=$SPECIFIED_REMOTE
            log_info "🚀 Push projet principal ($push_branch) → '$push_remote'..."

            # Exécuter Push
            push_cmd=(git -C "." push "$push_remote" "$push_branch") # Utiliser -C "."
            log_debug "Exécution push: ${push_cmd[*]}"
            push_output=""
            push_error=""
            push_status=0
            push_stderr_file="/tmp/push_git_push_stderr_$$"

            if [[ -n "$TIMEOUT_CMD" ]]; then
                push_output=$($TIMEOUT_CMD "$TIMEOUT" "${push_cmd[@]}" 2> "$push_stderr_file") || push_status=$?
            else
                push_output=$("${push_cmd[@]}" 2> "$push_stderr_file") || push_status=$?
            fi

            # Analyser résultat
            if [[ $push_status -ne 0 ]]; then
                log_debug "--- Sortie Push (stdout) principal --- \n$push_output\n--- Fin Sortie Push ---"
                if [[ -s "$push_stderr_file" ]]; then log_debug "--- Erreur Push (stderr) principal --- \n$(cat "$push_stderr_file")\n--- Fin Erreur Push ---"; fi
                rm -f "$push_stderr_file"
                handle_error "Timeout ($TIMEOUT s) ou erreur ($push_status) lors du push du projet principal vers '$push_remote/$push_branch'."
            fi
             log_debug "--- Sortie Push (stdout) principal --- \n$push_output\n--- Fin Sortie Push ---"
             if [[ -s "$push_stderr_file" ]]; then log_debug "--- Sortie Push (stderr) principal --- \n$(cat "$push_stderr_file")\n--- Fin Erreur Push ---"; fi
             rm -f "$push_stderr_file"

             log_success "Push du projet principal terminé."
        fi # Fin confirmation
    fi # Fin vérif changements
     log_debug "--- Fin Traitement Projet Principal ---"
fi # Fin traitement projet principal

# --- Fin Exécution ---
log_debug "Exécution principale terminée."
log_success "Opération terminée." # Message final

# Le trap 'cleanup' s'exécutera ici automatiquement
exit 0