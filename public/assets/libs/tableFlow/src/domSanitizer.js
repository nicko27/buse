// src/domSanitizer.js

/**
 * Utilitaire de sanitization et manipulation sécurisée du DOM
 * Prévient les attaques XSS en échappant le contenu dangereux
 */
export class DOMSanitizer {
    
    /**
     * Échappe les caractères spéciaux HTML
     * @param {string} text - Texte à échapper
     * @returns {string} - Texte échappé
     */
    static escapeHTML(text) {
        if (typeof text !== 'string') {
            return String(text);
        }
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        element.textContent = text;
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
            element.textContent = html;
            return;
        }
        
        // Si c'est un SVG ou une icône connue
        if (options.isTrustedIcon) {
            // Vérifier que l'icône est dans notre liste approuvée
            if (this.isTrustedIconContent(html)) {
                element.innerHTML = html;
                return;
            }
        }
        
        // Sinon, sanitizer le HTML
        element.innerHTML = this.sanitizeHTML(html, options);
    }
    
    /**
     * Sanitize une chaîne HTML
     * @param {string} html - HTML à sanitizer
     * @param {Object} options - Options de sanitization
     * @returns {string} - HTML sanitisé
     */
    static sanitizeHTML(html, options = {}) {
        if (typeof html !== 'string') {
            return '';
        }
        
        // Configuration par défaut
        const defaultOptions = {
            allowedTags: ['b', 'i', 'em', 'strong', 'span', 'br'],
            allowedAttributes: {
                'span': ['class', 'style', 'data-group']
            },
            allowedStyles: ['color', 'background-color'],
            ...options
        };
        
        // Utiliser DOMParser pour analyser le HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Fonction récursive pour nettoyer les nœuds
        const cleanNode = (node) => {
            // Supprimer les scripts et autres éléments dangereux
            const dangerousTags = ['script', 'iframe', 'object', 'embed', 'form'];
            if (dangerousTags.includes(node.nodeName.toLowerCase())) {
                node.remove();
                return;
            }
            
            // Vérifier si le tag est autorisé
            if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.nodeName.toLowerCase();
                
                if (!defaultOptions.allowedTags.includes(tagName)) {
                    // Remplacer par le contenu texte
                    const textNode = document.createTextNode(node.textContent);
                    node.replaceWith(textNode);
                    return;
                }
                
                // Nettoyer les attributs
                Array.from(node.attributes).forEach(attr => {
                    const allowedAttrs = defaultOptions.allowedAttributes[tagName] || [];
                    
                    if (!allowedAttrs.includes(attr.name)) {
                        node.removeAttribute(attr.name);
                    } else if (attr.name === 'style') {
                        // Nettoyer les styles
                        node.setAttribute('style', this.sanitizeStyles(attr.value, defaultOptions.allowedStyles));
                    }
                });
                
                // Nettoyer les événements inline
                Array.from(node.attributes).forEach(attr => {
                    if (attr.name.startsWith('on')) {
                        node.removeAttribute(attr.name);
                    }
                });
            }
            
            // Récursivement nettoyer les enfants
            Array.from(node.childNodes).forEach(child => cleanNode(child));
        };
        
        // Nettoyer le document
        cleanNode(doc.body);
        
        return doc.body.innerHTML;
    }
    
    /**
     * Sanitize les styles CSS
     * @param {string} styleString - Chaîne de style
     * @param {string[]} allowedStyles - Styles autorisés
     * @returns {string} - Styles sanitisés
     */
    static sanitizeStyles(styleString, allowedStyles = []) {
        const styles = styleString.split(';')
            .map(style => style.trim())
            .filter(style => style);
        
        const sanitizedStyles = styles.filter(style => {
            const [property] = style.split(':').map(s => s.trim());
            return allowedStyles.includes(property);
        });
        
        return sanitizedStyles.join('; ');
    }
    
    /**
     * Vérifie si le contenu est une icône de confiance
     * @param {string} content - Contenu à vérifier
     * @returns {boolean}
     */
    static isTrustedIconContent(content) {
        // Liste des patterns d'icônes de confiance
        const trustedPatterns = [
            /^<i class="fa[srlb]? fa-[\w-]+"><\/i>$/,  // Font Awesome
            /^<svg[\s\S]*?<\/svg>$/,                    // SVG inline
            /^<span class="material-icons">[\w-]+<\/span>$/ // Material Icons
        ];
        
        return trustedPatterns.some(pattern => pattern.test(content.trim()));
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
        const element = document.createElement(tagName);
        
        // Définir les attributs de manière sécurisée
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'class') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.entries(value).forEach(([prop, val]) => {
                    element.style[prop] = val;
                });
            } else if (!key.startsWith('on')) { // Éviter les événements inline
                element.setAttribute(key, value);
            }
        });
        
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
        
        // Créer un élément temporaire pour sanitizer le HTML
        const temp = document.createElement('div');
        this.setHTML(temp, html, options);
        
        // Insérer les nœuds sanitisés
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
            fragment.appendChild(temp.firstChild);
        }
        
        switch (position) {
            case 'beforebegin':
                parent.parentNode.insertBefore(fragment, parent);
                break;
            case 'afterbegin':
                parent.insertBefore(fragment, parent.firstChild);
                break;
            case 'beforeend':
                parent.appendChild(fragment);
                break;
            case 'afterend':
                parent.parentNode.insertBefore(fragment, parent.nextSibling);
                break;
            default:
                throw new Error('Invalid position');
        }
    }
}