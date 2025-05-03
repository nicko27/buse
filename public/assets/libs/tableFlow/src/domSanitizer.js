// src/domSanitizer.js

/**
 * Utilitaire de sanitization et manipulation sécurisée du DOM
 * Prévient les attaques XSS en échappant le contenu dangereux
 */
export class DOMSanitizer {
    
    // Configuration par défaut
    static defaults = {
        // Balises autorisées par défaut
        allowedTags: ['b', 'i', 'em', 'strong', 'span', 'br', 'div', 'p', 'a', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
        
        // Attributs autorisés par balise
        allowedAttributes: {
            '*': ['class', 'id', 'data-*'],
            'a': ['href', 'title', 'target', 'rel'],
            'img': ['src', 'alt', 'title', 'width', 'height'],
            'span': ['style', 'data-group'],
            'div': ['style'],
            'td': ['colspan', 'rowspan'],
            'th': ['colspan', 'rowspan']
        },
        
        // Styles CSS autorisés
        allowedStyles: [
            'color', 'background-color', 'background', 'font-size', 'font-weight', 
            'font-style', 'text-align', 'text-decoration', 'margin', 'padding',
            'border', 'border-radius', 'width', 'height', 'display', 'visibility',
            'opacity', 'transform', 'transition'
        ],
        
        // Schémas d'URL autorisés
        allowedSchemes: ['http', 'https', 'mailto', 'tel', 'data'],
        
        // Balises à supprimer complètement (y compris leur contenu)
        forbiddenTags: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'button'],
        
        // Attributs toujours interdits
        forbiddenAttributes: ['onclick', 'onload', 'onerror', 'onmouseover', 'onmouseout', 'onkeydown', 'onkeyup']
    };

    /**
     * Échappe les caractères spéciaux HTML
     * @param {string} text - Texte à échapper
     * @returns {string} - Texte échappé
     */
    static escapeHTML(text) {
        if (text == null) {
            return '';
        }
        
        const str = String(text);
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;',
            '`': '&#x60;',
            '=': '&#x3D;'
        };
        
        return str.replace(/[&<>"'`=\/]/g, char => escapeMap[char]);
    }
    
    /**
     * Décode les entités HTML
     * @param {string} text - Texte à décoder
     * @returns {string} - Texte décodé
     */
    static unescapeHTML(text) {
        if (!text) return '';
        
        const textarea = document.createElement('textarea');
        textarea.innerHTML = text;
        return textarea.value;
    }
    
    /**
     * Définit le texte d'un élément de manière sécurisée
     * @param {HTMLElement} element - Élément DOM
     * @param {string} text - Texte à définir
     */
    static setTextContent(element, text) {
        if (!element) {
            throw new Error('Element is required');
        }
        element.textContent = text == null ? '' : String(text);
    }
    
    /**
     * Définit le HTML d'un élément après sanitization
     * @param {HTMLElement} element - Élément DOM
     * @param {string} html - HTML à définir
     * @param {Object} options - Options de sanitization
     */
    static setHTML(element, html, options = {}) {
        if (!element) {
            throw new Error('Element is required');
        }
        
        // Si c'est du texte brut, utiliser textContent
        if (options.isPlainText) {
            element.textContent = html == null ? '' : String(html);
            return;
        }
        
        // Si c'est un SVG ou une icône de confiance
        if (options.isTrustedIcon && this.isTrustedIconContent(html)) {
            element.innerHTML = html;
            return;
        }
        
        // Sanitizer le HTML
        const sanitized = this.sanitizeHTML(html, options);
        element.innerHTML = sanitized;
    }
    
    /**
     * Sanitize une chaîne HTML
     * @param {string} html - HTML à sanitizer
     * @param {Object} options - Options de sanitization
     * @returns {string} - HTML sanitisé
     */
    static sanitizeHTML(html, options = {}) {
        if (!html) return '';
        
        // Fusionner avec les options par défaut
        const config = {
            ...this.defaults,
            ...options
        };
        
        // Créer un document temporaire
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Sanitizer le document
        this._sanitizeNode(doc.body, config);
        
        return doc.body.innerHTML;
    }
    
    /**
     * Sanitize un nœud DOM récursivement
     * @private
     */
    static _sanitizeNode(node, config) {
        if (!node) return;
        
        // Traiter les nœuds enfants d'abord (pour éviter les problèmes avec removeChild)
        const children = Array.from(node.childNodes);
        for (const child of children) {
            this._sanitizeNode(child, config);
        }
        
        // Ne traiter que les éléments
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        
        const tagName = node.tagName.toLowerCase();
        
        // Supprimer les balises interdites
        if (config.forbiddenTags.includes(tagName)) {
            node.remove();
            return;
        }
        
        // Vérifier si la balise est autorisée
        if (!config.allowedTags.includes(tagName)) {
            // Conserver le contenu texte mais supprimer la balise
            const fragment = document.createDocumentFragment();
            while (node.firstChild) {
                fragment.appendChild(node.firstChild);
            }
            node.replaceWith(fragment);
            return;
        }
        
        // Sanitizer les attributs
        this._sanitizeAttributes(node, tagName, config);
    }
    
    /**
     * Sanitize les attributs d'un élément
     * @private
     */
    static _sanitizeAttributes(element, tagName, config) {
        const attributes = Array.from(element.attributes);
        
        for (const attr of attributes) {
            const attrName = attr.name.toLowerCase();
            const attrValue = attr.value;
            
            // Supprimer les attributs interdits
            if (config.forbiddenAttributes.includes(attrName) || attrName.startsWith('on')) {
                element.removeAttribute(attrName);
                continue;
            }
            
            // Vérifier si l'attribut est autorisé
            const allowedForTag = config.allowedAttributes[tagName] || [];
            const allowedGlobally = config.allowedAttributes['*'] || [];
            
            let isAllowed = allowedForTag.includes(attrName) || allowedGlobally.includes(attrName);
            
            // Vérifier les attributs data-*
            if (!isAllowed && attrName.startsWith('data-')) {
                isAllowed = allowedGlobally.includes('data-*');
            }
            
            if (!isAllowed) {
                element.removeAttribute(attrName);
                continue;
            }
            
            // Traitement spécial pour certains attributs
            switch (attrName) {
                case 'href':
                case 'src':
                    const sanitizedUrl = this._sanitizeURL(attrValue, config.allowedSchemes);
                    if (sanitizedUrl) {
                        element.setAttribute(attrName, sanitizedUrl);
                    } else {
                        element.removeAttribute(attrName);
                    }
                    break;
                    
                case 'style':
                    const sanitizedStyle = this._sanitizeStyles(attrValue, config.allowedStyles);
                    if (sanitizedStyle) {
                        element.setAttribute('style', sanitizedStyle);
                    } else {
                        element.removeAttribute('style');
                    }
                    break;
                    
                case 'class':
                    const sanitizedClass = this._sanitizeClassNames(attrValue);
                    if (sanitizedClass) {
                        element.setAttribute('class', sanitizedClass);
                    } else {
                        element.removeAttribute('class');
                    }
                    break;
            }
        }
    }
    
    /**
     * Sanitize une URL
     * @private
     */
    static _sanitizeURL(url, allowedSchemes) {
        if (!url) return '';
        
        try {
            // Parser l'URL
            const urlObj = new URL(url, window.location.href);
            const protocol = urlObj.protocol.slice(0, -1); // Enlever le ':'
            
            // Vérifier si le schéma est autorisé
            if (allowedSchemes.includes(protocol)) {
                return urlObj.href;
            }
            
            // Autoriser les URLs relatives
            if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
                return url;
            }
            
            return '';
        } catch (e) {
            // URL invalide
            return '';
        }
    }
    
    /**
     * Sanitize les styles CSS
     * @private
     */
    static _sanitizeStyles(styleString, allowedStyles = []) {
        if (!styleString) return '';
        
        // Parser les styles
        const styles = styleString.split(';')
            .map(style => style.trim())
            .filter(style => style);
        
        const sanitizedStyles = [];
        
        for (const style of styles) {
            const [property, value] = style.split(':').map(s => s.trim());
            
            if (!property || !value) continue;
            
            // Vérifier si la propriété est autorisée
            if (!allowedStyles.includes(property)) continue;
            
            // Valider la valeur
            const sanitizedValue = this._sanitizeStyleValue(property, value);
            if (sanitizedValue) {
                sanitizedStyles.push(`${property}: ${sanitizedValue}`);
            }
        }
        
        return sanitizedStyles.join('; ');
    }
    
    /**
     * Sanitize une valeur de style CSS
     * @private
     */
    static _sanitizeStyleValue(property, value) {
        // Supprimer les expressions dangereuses
        if (value.includes('expression') || value.includes('javascript:') || value.includes('vbscript:')) {
            return '';
        }
        
        // Validation basique pour certaines propriétés
        switch (property) {
            case 'color':
            case 'background-color':
                // Accepter les formats de couleur courants
                if (/^(#[0-9a-f]{3,8}|rgb\(|rgba\(|hsl\(|hsla\(|[a-z]+)$/i.test(value)) {
                    return value;
                }
                break;
                
            case 'width':
            case 'height':
            case 'margin':
            case 'padding':
                // Accepter les unités CSS valides
                if (/^([0-9]+(\.[0-9]+)?(px|em|rem|%|vh|vw|pt|cm|mm|in|pc|ex|ch)?|auto|inherit|initial|unset)$/i.test(value)) {
                    return value;
                }
                break;
                
            default:
                // Pour les autres propriétés, faire une validation basique
                if (!/[<>]/.test(value)) {
                    return value;
                }
        }
        
        return '';
    }
    
    /**
     * Sanitize les noms de classe CSS
     * @private
     */
    static _sanitizeClassNames(classString) {
        if (!classString) return '';
        
        // Séparer les classes et filtrer les invalides
        const classes = classString.split(/\s+/)
            .filter(className => /^[a-zA-Z0-9_-]+$/.test(className));
        
        return classes.join(' ');
    }
    
    /**
     * Vérifie si le contenu est une icône de confiance
     * @param {string} content - Contenu à vérifier
     * @returns {boolean}
     */
    static isTrustedIconContent(content) {
        if (!content || typeof content !== 'string') return false;
        
        const trimmed = content.trim();
        
        // Patterns pour les icônes de confiance
        const trustedPatterns = [
            // Font Awesome (toutes versions)
            /^<i\s+class="fa[srlb]?\s+fa-[\w-]+(\s+fa-[\w-]+)*"(\s+[^>]*)?>[\s]*<\/i>$/i,
            
            // Material Icons
            /^<span\s+class="material-icons(-[\w]+)*"(\s+[^>]*)?>[\w\s-]+<\/span>$/i,
            
            // SVG inline basique
            /^<svg\s+[^>]*>([\s\S]*?)<\/svg>$/i,
            
            // Bootstrap Icons
            /^<i\s+class="bi\s+bi-[\w-]+"(\s+[^>]*)?>[\s]*<\/i>$/i,
            
            // Ionicons
            /^<ion-icon\s+name="[\w-]+"(\s+[^>]*)?>[\s]*<\/ion-icon>$/i
        ];
        
        return trustedPatterns.some(pattern => pattern.test(trimmed));
    }
    
    /**
     * Crée un élément DOM avec du contenu sécurisé
     * @param {string} tagName - Nom de la balise
     * @param {Object} attributes - Attributs de l'élément
     * @param {string} content - Contenu de l'élément
     * @param {Object} options - Options de sanitization
     * @returns {HTMLElement}
     */
    static createElement(tagName, attributes = {}, content = '', options = {}) {
        // Valider le nom de la balise
        if (!/^[a-z][a-z0-9-]*$/i.test(tagName)) {
            throw new Error('Invalid tag name');
        }
        
        const element = document.createElement(tagName);
        
        // Appliquer les attributs
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'style' && typeof value === 'object') {
                // Appliquer les styles un par un
                for (const [prop, val] of Object.entries(value)) {
                    if (this.defaults.allowedStyles.includes(prop)) {
                        element.style[prop] = val;
                    }
                }
            } else if (!key.startsWith('on') && !this.defaults.forbiddenAttributes.includes(key)) {
                element.setAttribute(key, value);
            }
        }
        
        // Définir le contenu
        if (content) {
            this.setHTML(element, content, options);
        }
        
        return element;
    }
    
    /**
     * Ajoute un élément de manière sécurisée
     * @param {HTMLElement} parent - Élément parent
     * @param {string} position - Position d'insertion
     * @param {string} html - HTML à insérer
     * @param {Object} options - Options de sanitization
     */
    static insertAdjacentHTML(parent, position, html, options = {}) {
        if (!parent) {
            throw new Error('Parent element is required');
        }
        
        const validPositions = ['beforebegin', 'afterbegin', 'beforeend', 'afterend'];
        if (!validPositions.includes(position)) {
            throw new Error('Invalid position');
        }
        
        // Sanitizer le HTML
        const sanitized = this.sanitizeHTML(html, options);
        
        // Créer un élément temporaire
        const temp = document.createElement('template');
        temp.innerHTML = sanitized;
        
        // Insérer le contenu
        switch (position) {
            case 'beforebegin':
                parent.before(temp.content);
                break;
            case 'afterbegin':
                parent.prepend(temp.content);
                break;
            case 'beforeend':
                parent.append(temp.content);
                break;
            case 'afterend':
                parent.after(temp.content);
                break;
        }
    }
    
    /**
     * Nettoie un élément DOM existant
     * @param {HTMLElement} element - Élément à nettoyer
     * @param {Object} options - Options de sanitization
     */
    static sanitizeElement(element, options = {}) {
        if (!element) return;
        
        const config = {
            ...this.defaults,
            ...options
        };
        
        this._sanitizeNode(element, config);
    }
    
    /**
     * Configure les options par défaut
     * @param {Object} options - Nouvelles options par défaut
     */
    static configure(options) {
        this.defaults = {
            ...this.defaults,
            ...options
        };
    }
}