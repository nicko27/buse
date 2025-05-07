# Script de Push Git Automatisé

Ce script permet d'automatiser les opérations de push Git, y compris la gestion des sous-modules, avec un système de résumé et de confirmation.

## Fonctionnalités

- 🔄 Gestion automatique des sous-modules Git
- 📝 Génération de messages de commit détaillés
- 🔍 Affichage d'un résumé des changements
- ✅ Système de confirmation avant chaque push
- 🎯 Sélection flexible des éléments à pousser
- 🛡️ Gestion robuste des erreurs

## Installation

1. Copiez le script dans votre projet :
```bash
cp push.sh /chemin/vers/votre/projet/
chmod +x push.sh
```

2. Assurez-vous que le script est exécutable :
```bash
chmod +x push.sh
```

## Utilisation

### Options disponibles

| Option | Description |
|--------|-------------|
| `-h, --help` | Affiche l'aide |
| `-a, --all` | Pousse tous les changements (sous-modules + principal) |
| `-m, --main` | Pousse uniquement le projet principal |
| `-s, --submodules` | Pousse uniquement les sous-modules |
| `-n, --no-confirm` | Ne demande pas de confirmation |
| `--submodule=NAME` | Pousse uniquement le sous-module spécifié |
| `--submodules=NAMES` | Pousse les sous-modules spécifiés (séparés par des virgules) |

### Exemples d'utilisation

1. **Pousser tout avec confirmation**
```bash
./push.sh -a
```

2. **Pousser uniquement le projet principal sans confirmation**
```bash
./push.sh -m -n
```

3. **Pousser un sous-module spécifique**
```bash
./push.sh --submodule=module1
```

4. **Pousser plusieurs sous-modules**
```bash
./push.sh --submodules=mod1,mod2
```

5. **Pousser tous les sous-modules**
```bash
./push.sh -s
```

## Format des messages de commit

Les messages de commit générés suivent ce format :

```
MAJ automatique (contexte) :

🟢 Ajoutés :
- fichier1.txt
- dossier/nouveau.txt

✏️ Modifiés :
- fichier2.php
- config.json

❌ Supprimés :
- ancien.txt

📊 Résumé : 3 fichiers modifiés, 2 insertions(+), 1 suppression(-)

🧾 Extrait des diffs :
fichier1.txt
    + ligne ajoutée
    - ligne supprimée
```

## Résumé des changements

Avant chaque push, le script affiche un résumé détaillé des changements :
- Liste des fichiers ajoutés
- Liste des fichiers modifiés
- Liste des fichiers supprimés
- Résumé statistique
- Extrait des diffs (limité à 10 lignes par défaut)

## Configuration

Le script peut être personnalisé en modifiant les variables suivantes dans le code :

```bash
MAX_DIFF_LINES=10  # Nombre maximum de lignes de diff à afficher
```

## Sécurité

- Le script vérifie l'état du répertoire de travail avant chaque opération
- Les opérations sur les sous-modules sont effectuées dans leur propre contexte
- Les chemins sont correctement échappés pour éviter les problèmes avec les espaces

## Dépannage

### Problèmes courants

1. **Erreur de permission**
```bash
chmod +x push.sh
```

2. **Sous-modules non initialisés**
```bash
git submodule update --init --recursive
```

3. **Problèmes de chemins avec espaces**
- Le script gère automatiquement les espaces dans les chemins

## Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changements (`git commit -m 'Add some AmazingFeature'`)
4. Pushez vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## Licence

Ce script est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

## Auteurs

- Votre Nom - [@votre-username](https://github.com/votre-username)

## Remerciements

- [Git](https://git-scm.com/) - Système de contrôle de version
- [Bash](https://www.gnu.org/software/bash/) - Shell Unix 