// src/domSanitizer.js

/**
 * Fournit des méthodes utilitaires pour nettoyer (sanitizer) et manipuler
 * de manière sécurisée le contenu HTML afin de prévenir les attaques XSS (Cross-Site Scripting).
 * Échappe ou supprime les balises, attributs et styles potentiellement dangereux.
 * @class DOMSanitizer
 */
export class DOMSanitizer {

    // Configuration par défaut pour la sanitization
    static defaults = {
        // Balises autorisées par défaut
        allowedTags: [
            'b', 'i', 'em', 'strong', 'span', 'br', 'div', 'p', 'a', 'ul', 'ol', 'li',
            'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', // Ajout des balises de tableau
            'img' // Ajout pour les images
        ],

        // Attributs autorisés par balise ('*' pour toutes les balises)
        allowedAttributes: {
            '*': ['class', 'id', 'style', 'title', 'data-*'], // Autorise 'style' globalement mais sera filtré
            'a': ['href', 'target', 'rel'],
            'img': ['src', 'alt', 'width', 'height'],
            'td': ['colspan', 'rowspan'],
            'th': ['colspan', 'rowspan'],
            // 'span': ['data-group'] // Déjà couvert par '*' et 'data-*'
        },

        // Styles CSS autorisés (propriétés)
        allowedStyles: [
            'color', 'background-color', 'background', 'font-size', 'font-weight',
            'font-style', 'text-align', 'text-decoration', 'margin', 'padding',
            'border', 'border-radius', 'width', 'height', 'display', 'visibility',
            'opacity', 'transform', 'transition', 'white-space', 'word-break', // Ajoutés pour l'édition highlight
            'caret-color', // Ajouté pour l'édition highlight
            'z-index', // Ajouté pour l'édition highlight
            'pointer-events', // Ajouté pour l'édition highlight
            'overflow' // Ajouté pour l'édition highlight
        ],

        // Schémas d'URL autorisés dans les attributs comme href, src
        allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],

        // Balises à supprimer complètement (elles et leur contenu)
        forbiddenTags: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],

        // Attributs toujours interdits, quel que soit la balise (principalement les gestionnaires d'événements)
        forbiddenAttributes: ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup', 'onfocus', 'onblur', 'onsubmit', 'onchange']
    };

    /**
     * Échappe les caractères spéciaux HTML pour prévenir l'interprétation comme du HTML.
     * @param {string | null | undefined} text - Texte à échapper.
     * @returns {string} - Texte échappé.
     */
    static escapeHTML(text) {
        // Retourne une chaîne vide si l'entrée est null ou undefined
        if (text == null) {
            return '';
        }

        const str = String(text);
        // Map des caractères à échapper et leurs entités HTML
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;', // Ou &apos; mais &#39; est plus sûr
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };

        // Remplace chaque caractère dangereux par son entité
        return str.replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
    }

    /**
     * Décode les entités HTML en caractères normaux.
     * Attention: N'utilisez ceci que sur du contenu de confiance ou déjà sanitisé.
     * @param {string} text - Texte contenant des entités HTML.
     * @returns {string} - Texte décodé.
     */
    static unescapeHTML(text) {
        if (!text) return '';

        // Utilise une astuce avec l'API DOM pour décoder les entités
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }

    /**
     * Définit le contenu textuel d'un élément DOM de manière sécurisée.
     * Remplace tout contenu existant. Utilise `textContent` pour éviter l'interprétation HTML.
     * @param {HTMLElement} element - L'élément DOM à modifier.
     * @param {string | null | undefined} text - Le texte à définir.
     * @throws {Error} Si l'élément n'est pas fourni.
     */
    static setTextContent(element, text) {
        if (!element || typeof element.textContent === 'undefined') {
             // Vérifie aussi que c'est bien un élément qui peut avoir textContent
            throw new Error('Element is required and must be a valid HTMLElement.');
        }
        // Assure que text est une chaîne, même si null ou undefined
        element.textContent = text == null ? '' : String(text);
    }

    /**
     * Définit le contenu HTML d'un élément après l'avoir sanitisé.
     * Remplace tout contenu existant.
     * @param {HTMLElement} element - L'élément DOM à modifier.
     * @param {string} html - La chaîne HTML à sanitizer et à définir.
     * @param {object} [options={}] - Options de sanitization à fusionner avec les défauts.
     * @param {boolean} [options.isPlainText=false] - Si true, traite `html` comme du texte brut (utilise `setTextContent`).
     * @param {boolean} [options.isTrustedIcon=false] - Si true, et si `html` correspond à un motif d'icône connu, l'insère sans sanitization complète (mais vérifie le motif).
     * @throws {Error} Si l'élément n'est pas fourni.
     */
    static setHTML(element, html, options = {}) {
        if (!element || typeof element.innerHTML === 'undefined') {
            throw new Error('Element is required and must be a valid HTMLElement.');
        }

        // Option pour traiter comme texte brut
        if (options.isPlainText) {
            this.setTextContent(element, html);
            return;
        }

        // Option pour les icônes de confiance (ex: FontAwesome)
        // Vérifie si le contenu ressemble à une balise <i> ou <svg> simple
        if (options.isTrustedIcon && this.isTrustedIconContent(html)) {
            // Attention: Ceci fait confiance au motif défini dans isTrustedIconContent.
            // Ne pas utiliser si la source de 'html' n'est pas contrôlée.
            element.innerHTML = html;
            return;
        }

        // Sinon, sanitizer le HTML avant de l'insérer
        const sanitized = this.sanitizeHTML(html, options);
        element.innerHTML = sanitized;
    }

    /**
     * Nettoie une chaîne HTML en supprimant les éléments et attributs dangereux.
     * @param {string} html - La chaîne HTML brute à nettoyer.
     * @param {object} [options={}] - Options de configuration pour la sanitization, fusionnées avec `DOMSanitizer.defaults`.
     * @returns {string} - La chaîne HTML nettoyée et sûre.
     */
    static sanitizeHTML(html, options = {}) {
        if (html == null || html === '') return ''; // Gère null, undefined et chaîne vide

        // Performance Note: La création d'un DOMParser et d'un document temporaire
        // peut avoir un impact sur les performances si appelée très fréquemment.
        // Pour des besoins de haute performance, explorer des bibliothèques dédiées
        // ou l'API Trusted Types si supportée par les navigateurs cibles.
        const parser = new DOMParser();
        // Utilise text/html pour créer un document complet (plus sûr que juste un fragment)
        const doc = parser.parseFromString(html, 'text/html');

        // Fusionner les options fournies avec les options par défaut
        const config = {
            // Créer une copie profonde des défauts pour éviter la mutation
            allowedTags: [...this.defaults.allowedTags, ...(options.allowedTags || [])],
            allowedAttributes: { ...this.defaults.allowedAttributes, ...(options.allowedAttributes || {}) },
            allowedStyles: [...this.defaults.allowedStyles, ...(options.allowedStyles || [])],
            allowedSchemes: [...this.defaults.allowedSchemes, ...(options.allowedSchemes || [])],
            forbiddenTags: [...this.defaults.forbiddenTags, ...(options.forbiddenTags || [])],
            forbiddenAttributes: [...this.defaults.forbiddenAttributes, ...(options.forbiddenAttributes || [])]
        };
        // S'assurer que '*' existe dans allowedAttributes si on fusionne
        config.allowedAttributes['*'] = [
            ...(this.defaults.allowedAttributes['*'] || []),
            ...(options.allowedAttributes?.['*'] || [])
        ];


        // Lancer la sanitization récursive sur le corps du document parsé
        this._sanitizeNode(doc.body, config);

        // Retourner le contenu HTML nettoyé du corps
        return doc.body.innerHTML;
    }

    /**
     * Fonction récursive privée pour nettoyer un nœud DOM et ses descendants.
     * @param {Node} node - Le nœud DOM à nettoyer.
     * @param {object} config - La configuration de sanitization active.
     * @private
     */
    static _sanitizeNode(node, config) {
        if (!node) return;

        // 1. Nettoyer les enfants d'abord (approche post-ordre)
        // Copie des enfants car la liste peut être modifiée pendant l'itération
        const children = Array.from(node.childNodes);
        for (const child of children) {
            this._sanitizeNode(child, config);
        }

        // 2. Traiter le nœud courant (seulement si c'est un élément)
        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = /** @type {HTMLElement} */ (node); // Cast pour l'IDE
            const tagName = element.tagName.toLowerCase();

            // 2a. Supprimer les balises complètement interdites
            if (config.forbiddenTags.includes(tagName)) {
                element.remove(); // Supprime l'élément et tout son contenu
                return; // Arrêter le traitement pour ce nœud
            }

            // 2b. Vérifier si la balise est autorisée
            if (!config.allowedTags.includes(tagName)) {
                // Si non autorisée, supprimer la balise mais conserver ses enfants (aplatir)
                // Créer un fragment pour déplacer les enfants
                const fragment = document.createDocumentFragment();
                // Utilise element.childNodes pour déplacer les nœuds restants (qui ont été sanitisés)
                while (element.firstChild) {
                    fragment.appendChild(element.firstChild);
                }
                // Remplacer l'élément par son contenu
                element.replaceWith(fragment);
                return; // Arrêter le traitement pour cet élément (qui n'existe plus)
            }

            // 2c. Si la balise est autorisée, nettoyer ses attributs
            this._sanitizeAttributes(element, tagName, config);
        }
        // Les nœuds texte, commentaires, etc., sont conservés tels quels par défaut
    }

    /**
     * Nettoie les attributs d'un élément DOM donné.
     * @param {HTMLElement} element - L'élément dont les attributs doivent être nettoyés.
     * @param {string} tagName - Le nom de la balise (en minuscules).
     * @param {object} config - La configuration de sanitization active.
     * @private
     */
    static _sanitizeAttributes(element, tagName, config) {
        // Copie des attributs car la collection peut changer
        const attributes = Array.from(element.attributes);

        for (const attr of attributes) {
            const attrName = attr.name.toLowerCase(); // Normaliser en minuscules
            const attrValue = attr.value;

            // 1. Vérifier les attributs globalement interdits (ex: gestionnaires d'événements)
            if (config.forbiddenAttributes.includes(attrName) || attrName.startsWith('on')) {
                element.removeAttribute(attr.name); // Utiliser le nom original pour la suppression
                continue; // Passer à l'attribut suivant
            }

            // 2. Vérifier si l'attribut est autorisé pour cette balise ou globalement
            const allowedForTag = config.allowedAttributes[tagName] || [];
            const allowedGlobally = config.allowedAttributes['*'] || [];

            let isAllowed = allowedForTag.includes(attrName) || allowedGlobally.includes(attrName);

            // 2a. Cas spécifique pour data-*
            if (!isAllowed && attrName.startsWith('data-')) {
                isAllowed = allowedGlobally.includes('data-*');
            }

            // 3. Si l'attribut n'est pas autorisé, le supprimer
            if (!isAllowed) {
                element.removeAttribute(attr.name);
                continue; // Passer à l'attribut suivant
            }

            // 4. Traitement spécifique pour les attributs autorisés mais potentiellement dangereux
            switch (attrName) {
                case 'href':
                case 'src':
                    // Nettoyer l'URL
                    const sanitizedUrl = this._sanitizeURL(attrValue, config.allowedSchemes);
                    if (sanitizedUrl) {
                        // Mettre à jour l'attribut avec l'URL nettoyée
                        element.setAttribute(attr.name, sanitizedUrl);
                    } else {
                        // Si l'URL est invalide ou non autorisée, supprimer l'attribut
                        element.removeAttribute(attr.name);
                    }
                    break;

                case 'style':
                    // Nettoyer les déclarations de style inline
                    const sanitizedStyle = this._sanitizeStyles(attrValue, config.allowedStyles);
                    if (sanitizedStyle) {
                        // Mettre à jour l'attribut avec les styles nettoyés
                        element.setAttribute('style', sanitizedStyle); // Utilise 'style' en minuscule
                    } else {
                        // Si aucun style valide ne reste, supprimer l'attribut
                        element.removeAttribute('style');
                    }
                    break;

                case 'class':
                    // Nettoyer les noms de classe (supprimer les caractères invalides)
                    const sanitizedClass = this._sanitizeClassNames(attrValue);
                    if (sanitizedClass) {
                        element.setAttribute('class', sanitizedClass);
                    } else {
                        element.removeAttribute('class');
                    }
                    break;

                // Ajouter d'autres cas spécifiques si nécessaire (ex: srcset pour img)
            }
        }
    }

    /**
     * Valide et nettoie une URL.
     * @param {string} url - L'URL à vérifier.
     * @param {string[]} allowedSchemes - Liste des schémas autorisés (ex: ['http', 'https']).
     * @returns {string} L'URL nettoyée et validée, ou une chaîne vide si invalide/non autorisée.
     * @private
     */
    static _sanitizeURL(url, allowedSchemes) {
        if (!url) return '';

        try {
            // Tenter de parser l'URL. Utilise window.location.href comme base pour les relatives.
            // Attention: peut échouer si window.location.href est 'about:blank' dans certains contextes.
            const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
            const urlObj = new URL(url, base);

            // Récupérer le protocole (ex: 'http:', 'https:') et le normaliser
            const protocol = (urlObj.protocol || '').slice(0, -1).toLowerCase(); // Enlève le ':' et minuscule

            // 1. Vérifier si le protocole est dans la liste autorisée
            if (allowedSchemes.includes(protocol)) {
                return urlObj.href; // Retourne l'URL absolue reconstruite et validée
            }

            // 2. Si pas de protocole explicite (URL relative), la considérer sûre par défaut
            // (ex: '/images/logo.png', 'page.html')
            // `new URL` aura assigné un protocole (celui de `base`), donc on vérifie l'URL originale.
            // Une URL relative simple ne contient pas de ':' avant le premier '/'.
            // Attention aux URLs relatives de protocole (ex: //example.com)
            if (!url.includes(':') || url.match(/^\/\//) || url.match(/^\/[^/]/) || url.match(/^\.\.?\//) || !url.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:/)) {
                 // Vérifie si ça commence par //, /, ./, ../ ou n'a pas de schéma au début
                 // C'est une heuristique, peut nécessiter ajustement.
                 // On retourne l'URL originale car new URL() l'aura absolutisée.
                return url;
            }

            // Si le protocole n'est pas autorisé et que ce n'est pas une URL relative simple
            this.defaults.logger?.warn?.(`[DOMSanitizer] URL bloquée (schéma non autorisé: ${protocol}): ${url}`);
            return '';
        } catch (e) {
            // Si l'URL est invalide et ne peut pas être parsée
            this.defaults.logger?.warn?.(`[DOMSanitizer] URL invalide ou erreur de parsing: ${url}`, e);
            return '';
        }
    }

    /**
     * Nettoie une chaîne de styles CSS inline.
     * @param {string} styleString - La chaîne de l'attribut 'style'.
     * @param {string[]} [allowedStyles=[]] - Liste des propriétés CSS autorisées.
     * @returns {string} La chaîne de styles nettoyée, ou une chaîne vide.
     * @private
     */
    static _sanitizeStyles(styleString, allowedStyles = []) {
        if (!styleString) return '';

        const sanitizedDeclarations = [];

        // Sépare les déclarations (ex: "color: red; background-color: blue;")
        styleString.split(';').forEach(declaration => {
            declaration = declaration.trim();
            if (!declaration) return;

            // Sépare la propriété et la valeur
            const parts = declaration.split(':');
            if (parts.length < 2) return; // Déclaration invalide

            const property = parts[0].trim().toLowerCase();
            const value = parts.slice(1).join(':').trim(); // Rejoindre au cas où la valeur contient ':'

            // Vérifier si la propriété est autorisée
            if (allowedStyles.includes(property)) {
                // Nettoyer la valeur
                const sanitizedValue = this._sanitizeStyleValue(property, value);
                if (sanitizedValue) {
                    // Utiliser la propriété originale (pas en minuscule) pour la sortie
                    sanitizedDeclarations.push(`${parts[0].trim()}: ${sanitizedValue}`);
                } else {
                     this.defaults.logger?.warn?.(`[DOMSanitizer] Valeur de style bloquée pour '${property}': ${value}`);
                }
            } else {
                 this.defaults.logger?.warn?.(`[DOMSanitizer] Propriété de style non autorisée bloquée: '${property}'`);
            }
        });

        return sanitizedDeclarations.join('; ');
    }

    /**
     * Valide et nettoie une valeur de style CSS.
     * @param {string} property - La propriété CSS (en minuscules).
     * @param {string} value - La valeur CSS brute.
     * @returns {string} La valeur nettoyée ou une chaîne vide si invalide/dangereuse.
     * @private
     */
    static _sanitizeStyleValue(property, value) {
        // 1. Bloquer les valeurs contenant des mots-clés dangereux ou des tentatives d'exécution
        const dangerousKeywords = ['expression', 'javascript:', 'vbscript:', 'url(', '<', '>'];
        if (dangerousKeywords.some(keyword => value.toLowerCase().includes(keyword))) {
            // Exception pour url() si c'est pour background ou border-image et que l'URL est valide?
            // Pour l'instant, blocage simple.
            if (!property.startsWith('background') && !property.startsWith('border-image') || !value.toLowerCase().startsWith('url(')) {
                 return '';
            }
            // Si c'est url(), extraire et valider l'URL interne (logique plus complexe requise)
            // Pour l'instant, on bloque url() aussi par sécurité.
             return '';
        }

        // 2. Validation spécifique par propriété (peut être étendue)
        switch (property) {
            case 'color':
            case 'background-color':
                // Accepte hex, rgb(a), hsl(a), mots-clés CSS
                if (/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|[a-z-]+)$/i.test(value)) {
                    return value;
                }
                break;

            case 'font-weight':
                if (/^(normal|bold|bolder|lighter|[1-9]00)$/i.test(value)) {
                    return value;
                }
                break;

            case 'text-decoration': // Peut avoir plusieurs valeurs
                 if (/^(none|underline|overline|line-through|blink)(\s+(none|underline|overline|line-through|blink))*$/i.test(value)) {
                     return value;
                 }
                 break;

            // Pour les dimensions, marges, etc. - validation plus permissive mais bloque les cas évidents
            case 'width':
            case 'height':
            case 'font-size':
            case 'margin':
            case 'padding':
            case 'border-radius':
            // ... autres propriétés numériques ou de dimension
                // Accepte nombres, unités CSS courantes, pourcentages, auto, etc.
                // Bloque les caractères qui ne devraient pas s'y trouver (<, >, etc.)
                if (/^[\w\d\s.,%+-]+$/.test(value) && !/[<>]/.test(value)) {
                    return value;
                }
                break;

            default:
                // Pour les autres propriétés autorisées, on fait une validation très basique:
                // On bloque juste si ça contient des caractères HTML potentiellement dangereux.
                if (!/[<>]/.test(value)) {
                    return value;
                }
        }

        // Si aucune validation n'a réussi
        return '';
    }

    /**
     * Nettoie une chaîne de noms de classe CSS.
     * Supprime les caractères invalides et les classes vides.
     * @param {string} classString - La chaîne de l'attribut 'class'.
     * @returns {string} La chaîne de classes nettoyée.
     * @private
     */
    static _sanitizeClassNames(classString) {
        if (!classString) return '';

        // Sépare par espace, filtre les classes valides (alphanumérique, -, _)
        const classes = classString.split(/\s+/)
            .map(className => className.trim())
            // Regex: Doit commencer par - ou _, ou une lettre. Peut contenir lettres, chiffres, -, _
            .filter(className => className && /^-?[_a-zA-Z]+[_a-zA-Z0-9-]*$/.test(className));

        return classes.join(' ');
    }

    /**
     * Vérifie de manière heuristique si une chaîne HTML représente une icône "de confiance"
     * (ex: FontAwesome <i>, SVG simple). Utilisé par `setHTML` avec l'option `isTrustedIcon`.
     * @param {string} content - La chaîne HTML à vérifier.
     * @returns {boolean} True si le contenu correspond à un motif d'icône connu.
     */
    static isTrustedIconContent(content) {
        if (!content || typeof content !== 'string') return false;

        const trimmed = content.trim();

        // Commentaire: Ces regex devraient être maintenues à jour
        // si de nouvelles bibliothèques d'icônes sont utilisées ou si les formats changent.
        const trustedPatterns = [
            // Font Awesome (versions 4, 5, 6 - fa, fas, far, fal, fab)
            /^<i\s+class="fa[srlbd]?\s+fa-[\w-]+(?:(?:\s+fa-(?:[\w-]+|fw|rotate-\d+|flip-\w+|spin|pulse|border|pull-\w+|stack(?:-\dx)?|inverse))|(?:\s+style="[^"]*"))*\s*"[^>]*>[\s]*<\/i>$/i,
            // SVG inline simple (vérification basique - pourrait être renforcée)
            /^<svg[\s\S]*?>[\s\S]*?<\/svg>$/i,
            // Material Icons (balise span ou i)
            /^<(span|i)\s+class="material-icons(?:-outlined|-round|-sharp|-two-tone)?"[^>]*>[\w\s_]+<\/(span|i)>$/i,
            // Bootstrap Icons
            /^<i\s+class="bi\s+bi-[\w-]+"[^>]*>[\s]*<\/i>$/i,
            // Ionicons
            /^<ion-icon\s+name="[\w-]+"[^>]*>[\s]*<\/ion-icon>$/i
            // Ajouter d'autres motifs si nécessaire
        ];

        // Teste si le contenu correspond à l'un des motifs
        return trustedPatterns.some(pattern => pattern.test(trimmed));
    }

    /**
     * Crée un élément DOM de manière sécurisée.
     * Le nom de la balise est validé, les attributs sont filtrés (mais non sanitisés en profondeur ici),
     * et le contenu est inséré via `setHTML` (donc sanitisé).
     * @param {string} tagName - Nom de la balise (ex: 'div', 'span').
     * @param {object} [attributes={}] - Objet clé/valeur des attributs. Les styles peuvent être un objet.
     * @param {string} [content=''] - Contenu HTML ou texte brut (selon options).
     * @param {object} [options={}] - Options passées à `setHTML` pour le contenu.
     * @returns {HTMLElement} L'élément créé.
     * @throws {Error} Si le nom de la balise est invalide.
     */
    static createElement(tagName, attributes = {}, content = '', options = {}) {
        // Validation simple du nom de balise (évite injection via tagName)
        if (!/^[a-z][a-z0-9-]*$/i.test(tagName) || this.defaults.forbiddenTags.includes(tagName.toLowerCase())) {
            this.defaults.logger?.error?.(`[DOMSanitizer] Tentative de création d'un élément avec un nom de balise invalide ou interdit: ${tagName}`);
            throw new Error(`Invalid or forbidden tag name: ${tagName}`);
        }

        const element = document.createElement(tagName);

        // Appliquer les attributs (filtrage basique des événements 'on*')
        for (const [key, value] of Object.entries(attributes)) {
            const lowerKey = key.toLowerCase();
            // Ne pas autoriser les attributs commençant par 'on' ou listés comme interdits
            if (!lowerKey.startsWith('on') && !this.defaults.forbiddenAttributes.includes(lowerKey)) {
                if (key === 'style' && typeof value === 'object' && value !== null) {
                    // Appliquer les styles depuis un objet (filtrage basique)
                    Object.entries(value).forEach(([prop, val]) => {
                        // Ici, on ne re-sanitize pas en profondeur, on fait confiance
                        // aux propriétés fournies, mais on vérifie si elles sont autorisées.
                        if (this.defaults.allowedStyles.includes(prop.toLowerCase())) {
                             try {
                                 element.style[prop] = String(val); // Assigne le style
                             } catch (e) {
                                 this.defaults.logger?.warn?.(`[DOMSanitizer] Erreur lors de l'application du style '${prop}': ${val}`, e);
                             }
                        } else {
                             this.defaults.logger?.warn?.(`[DOMSanitizer] Style non autorisé ignoré lors de createElement: '${prop}'`);
                        }
                    });
                } else {
                    // Attributs normaux (chaînes)
                    // Note: La valeur n'est pas sanitisée ici (ex: URL dans href).
                    // La sanitization complète se fait via sanitizeHTML ou sanitizeElement.
                    element.setAttribute(key, String(value));
                }
            } else {
                 this.defaults.logger?.warn?.(`[DOMSanitizer] Attribut interdit ignoré lors de createElement: '${key}'`);
            }
        }

        // Définir le contenu (sanitisé par setHTML)
        if (content) {
            this.setHTML(element, content, options);
        }

        return element;
    }

    /**
     * Insère du HTML à une position adjacente à un élément, après l'avoir sanitisé.
     * @param {HTMLElement} parent - L'élément de référence pour l'insertion.
     * @param {'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'} position - La position par rapport au parent.
     * @param {string} html - La chaîne HTML à sanitizer et à insérer.
     * @param {object} [options={}] - Options de sanitization à passer à `sanitizeHTML`.
     * @throws {Error} Si le parent ou la position sont invalides.
     */
    static insertAdjacentHTML(parent, position, html, options = {}) {
        if (!parent || typeof parent.insertAdjacentHTML !== 'function') {
            throw new Error('Parent element is required and must be a valid HTMLElement.');
        }

        const validPositions = ['beforebegin', 'afterbegin', 'beforeend', 'afterend'];
        if (!validPositions.includes(position)) {
            throw new Error(`Invalid position: ${position}. Must be one of ${validPositions.join(', ')}`);
        }

        // 1. Sanitizer le HTML
        const sanitizedHtml = this.sanitizeHTML(html, options);

        // 2. Insérer le HTML sanitisé en utilisant la méthode native
        // C'est généralement sûr car le HTML a déjà été nettoyé.
        // Cependant, certains navigateurs peuvent avoir des bugs.
        // Une alternative plus sûre (mais potentiellement plus lente) serait de
        // créer un fragment, d'y mettre le sanitizedHtml, puis d'insérer les nœuds du fragment.
        try {
             parent.insertAdjacentHTML(position, sanitizedHtml);
        } catch (error) {
             this.defaults.logger?.error?.(`[DOMSanitizer] Erreur lors de insertAdjacentHTML (après sanitization): ${error.message}`, { position, sanitizedHtml });
             // Alternative plus sûre en cas d'erreur de insertAdjacentHTML :
             // const temp = document.createElement('template');
             // temp.innerHTML = sanitizedHtml;
             // const content = temp.content;
             // switch (position) {
             //     case 'beforebegin': parent.before(content); break;
             //     case 'afterbegin': parent.prepend(content); break;
             //     case 'beforeend': parent.append(content); break;
             //     case 'afterend': parent.after(content); break;
             // }
        }
    }

    /**
     * Nettoie un élément DOM existant et ses descendants en place.
     * @param {HTMLElement} element - L'élément à nettoyer.
     * @param {object} [options={}] - Options de sanitization à fusionner avec les défauts.
     */
    static sanitizeElement(element, options = {}) {
        if (!element || typeof element.tagName === 'undefined') {
             this.defaults.logger?.warn?.(`[DOMSanitizer] sanitizeElement appelé avec un élément invalide.`);
             return;
        }

        const config = {
            // Créer une copie profonde des défauts pour éviter la mutation
            allowedTags: [...this.defaults.allowedTags, ...(options.allowedTags || [])],
            allowedAttributes: { ...this.defaults.allowedAttributes, ...(options.allowedAttributes || {}) },
            allowedStyles: [...this.defaults.allowedStyles, ...(options.allowedStyles || [])],
            allowedSchemes: [...this.defaults.allowedSchemes, ...(options.allowedSchemes || [])],
            forbiddenTags: [...this.defaults.forbiddenTags, ...(options.forbiddenTags || [])],
            forbiddenAttributes: [...this.defaults.forbiddenAttributes, ...(options.forbiddenAttributes || [])]
        };
         // S'assurer que '*' existe dans allowedAttributes si on fusionne
         config.allowedAttributes['*'] = [
             ...(this.defaults.allowedAttributes['*'] || []),
             ...(options.allowedAttributes?.['*'] || [])
         ];


        this.logger.debug?.(`[DOMSanitizer] Nettoyage de l'élément:`, element);
        this._sanitizeNode(element, config);
    }

    /**
     * Permet de surcharger ou d'étendre la configuration par défaut du sanitizer.
     * @param {object} options - Nouvelles options par défaut à fusionner avec les existantes.
     */
    static configure(options) {
        // Fusion profonde pour les tableaux et objets imbriqués
        const mergeDeep = (target, source) => {
            for (const key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    const targetValue = target[key];
                    const sourceValue = source[key];

                    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                        // Fusionner les tableaux en évitant les doublons
                        target[key] = [...new Set([...targetValue, ...sourceValue])];
                    } else if (typeof targetValue === 'object' && targetValue !== null && typeof sourceValue === 'object' && sourceValue !== null) {
                        // Fusionner les objets récursivement
                        mergeDeep(targetValue, sourceValue);
                    } else {
                        // Remplacer les valeurs primitives
                        target[key] = sourceValue;
                    }
                }
            }
        };

        mergeDeep(this.defaults, options);
        this.logger.info?.(`[DOMSanitizer] Configuration par défaut mise à jour.`);
    }
}

// Attribuer un logger par défaut à la classe statique pour les messages internes
DOMSanitizer.defaults.logger = console;
