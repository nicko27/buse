/**
 * Gestionnaire de sélection de couleur simple et efficace.
 */
class ColorFlow{
    constructor(config = {}) {
        this.config = {
            presetColors: [
                { color: '#FF0000', label: 'RED' },
                { color: '#00FF00', label: 'GRN' },
                { color: '#0000FF', label: 'BLU' },
                { color: '#FFFF00', label: 'YLW' },
                { color: '#FF00FF', label: 'MAG' },
                { color: '#00FFFF', label: 'CYN' },
                { color: '#000000', label: 'BLK' },
                { color: '#FFFFFF', label: 'WHT' }
            ],
            customClass: '',
            debug: false,
            ...config
        };

        this.init();
    }

    init() {
        // Find all inputs with cf-input attribute
        const inputs = document.querySelectorAll('[cf-input]');
        inputs.forEach(input => {
            this.setupInput(input);
        });

        // Global click handler
        document.addEventListener('click', this.handleDocumentClick.bind(this));

        this.createColorPicker();
    }

    setupInput(input) {
        // Get configuration from attributes
        const format = input.getAttribute('cf-format') || 'hex';
        const hasAlpha = input.hasAttribute('cf-alpha');
        const hasPalette = input.hasAttribute('cf-palette');
        const defaultColor = input.getAttribute('cf-default') || '#000000';

        // Set initial value if empty
        if (!input.value) {
            input.value = defaultColor.toUpperCase();
        } else {
            input.value = input.value.toUpperCase();
        }

        // Validate color
        if (!this.isValidColor(input.value)) {
            input.value = defaultColor.toUpperCase();
        }

        // Create color preview
        const preview = document.createElement('div');
        preview.className = 'color-preview';
        if (this.config.customClass) {
            preview.classList.add(this.config.customClass);
        }
        preview.style.backgroundColor = input.value;
        input.parentNode.insertBefore(preview, input);

        // Setup event listeners
        input.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPicker(input, preview);
        });

        preview.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showPicker(input, preview);
        });

        // Add input validation
        input.addEventListener('change', (e) => {
            const newColor = e.target.value;
            if (this.isValidColor(newColor)) {
                preview.style.backgroundColor = newColor;
            } else {
                e.target.value = preview.style.backgroundColor;
            }
        });
    }

    isValidColor(color) {
        if (!color) return false;
        const style = new Option().style;
        style.color = color;
        return style.color !== '';
    }

    createColorPicker() {
        this.picker = document.createElement('div');
        this.picker.className = 'nv-color-picker';
        if (this.config.customClass) {
            this.picker.classList.add(this.config.customClass);
        }

        // Créer le canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'nv-color-canvas';
        if (this.config.customClass) {
            this.canvas.classList.add(this.config.customClass);
        }
        
        // Définir la taille du canvas pour le rendu
        this.canvas.width = 200;
        this.canvas.height = 120;
        
        this.picker.appendChild(this.canvas);
        this.updateCanvas();

        // Créer la section des couleurs prédéfinies
        const presets = document.createElement('div');
        presets.className = 'nv-color-presets';
        if (this.config.customClass) {
            presets.classList.add(this.config.customClass);
        }
        
        this.config.presetColors.forEach(preset => {
            const presetButton = document.createElement('div');
            presetButton.className = 'nv-color-preset';
            if (this.config.customClass) {
                presetButton.classList.add(this.config.customClass);
            }
            presetButton.style.backgroundColor = preset.color;
            presetButton.textContent = preset.label;
            presetButton.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleColorSelect(preset.color);
            });
            presets.appendChild(presetButton);
        });
        
        this.picker.appendChild(presets);
        document.body.appendChild(this.picker);
        this.picker.style.display = 'none';

        // Gestionnaire de clic sur le canvas
        this.canvas.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            const color = this.getColorFromEvent(e);
            if (color) {
                this.handleColorSelect(color);
            }
        });

        // Gestionnaire de mouvement sur le canvas
        this.canvas.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) {
                e.stopPropagation();
                const color = this.getColorFromEvent(e);
                if (color) {
                    this.handleColorSelect(color);
                }
            }
        });
    }

    getColorFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        
        return this.getColorAtPosition(x, y);
    }

    updateCanvas() {
        const ctx = this.canvas.getContext('2d');
        
        // Dégradé de teinte (horizontal)
        const hueGradient = ctx.createLinearGradient(0, 0, this.canvas.width, 0);
        for (let i = 0; i <= 360; i += 30) {
            hueGradient.addColorStop(i / 360, `hsl(${i}, 100%, 50%)`);
        }
        ctx.fillStyle = hueGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Dégradé de saturation (vertical haut)
        const saturationGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height / 2);
        saturationGradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        saturationGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = saturationGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height / 2);

        // Dégradé de luminosité (vertical bas)
        const brightnessGradient = ctx.createLinearGradient(0, this.canvas.height / 2, 0, this.canvas.height);
        brightnessGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        brightnessGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');
        ctx.fillStyle = brightnessGradient;
        ctx.fillRect(0, this.canvas.height / 2, this.canvas.width, this.canvas.height / 2);
    }

    getColorAtPosition(x, y) {
        // S'assurer que les coordonnées sont dans les limites du canvas
        x = Math.max(0, Math.min(x, this.canvas.width - 1));
        y = Math.max(0, Math.min(y, this.canvas.height - 1));
        
        const ctx = this.canvas.getContext('2d');
        const pixel = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
        
        return `#${[pixel[0], pixel[1], pixel[2]].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('')}`;
    }

    toRGBColor(color) {
        const style = new Option().style;
        style.color = color;
        return style.color;
    }

    toHexColor(color) {
        if (!color) return '#000000';
        
        // Si déjà en hexadécimal, retourner en majuscules
        if (color.startsWith('#')) {
            return color.toUpperCase();
        }
        
        // Pour les couleurs rgb()
        if (color.startsWith('rgb')) {
            const rgb = color.match(/\d+/g);
            if (rgb && rgb.length >= 3) {
                const hex = '#' + rgb.map(x => {
                    const hex = parseInt(x).toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                }).join('');
                return hex.toUpperCase();
            }
        }
        
        // Pour les noms de couleurs
        const div = document.createElement('div');
        div.style.color = color;
        document.body.appendChild(div);
        const rgb = window.getComputedStyle(div).color;
        document.body.removeChild(div);
        
        const values = rgb.match(/\d+/g);
        if (values && values.length >= 3) {
            const hex = '#' + values.map(x => {
                const hex = parseInt(x).toString(16);
                return hex.length === 1 ? '0' + hex : hex;
            }).join('');
            return hex.toUpperCase();
        }
        
        return '#000000';
    }

    handleColorSelect(color) {
        if (this.currentCallback) {
            // Convertir la couleur en majuscules avant de la passer au callback
            const upperColor = typeof color === 'string' ? this.toHexColor(color) : color;
            this.currentCallback(upperColor);
            this.hidePicker();
        }
    }

    handleDocumentClick(e) {
        if (this.isPickerVisible && !this.picker.contains(e.target)) {
            this.hidePicker();
        }
    }

    hidePicker() {
        if (this.picker) {
            this.picker.style.display = 'none';
            this.isPickerVisible = false;
            this.currentCallback = null;
        }
    }

    showPicker(input, preview) {
        if (this.isPickerVisible) {
            this.hidePicker();
        }

        this.currentCallback = (color) => {
            if (this.isValidColor(color)) {
                input.value = color.toUpperCase();
                preview.style.backgroundColor = color;
                
                // Déclencher l'événement change
                const event = new Event('change', {
                    bubbles: true,
                    cancelable: true,
                });
                input.dispatchEvent(event);
            }
        };
        
        const rect = input.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        const pickerWidth = 200;
        const pickerHeight = 200;

        let top = rect.bottom + scrollTop;
        let left = rect.left + scrollLeft;

        if (left + pickerWidth > window.innerWidth) {
            left = rect.right - pickerWidth + scrollLeft;
            if (left < 0) {
                left = 10;
            }
        }

        if (top + pickerHeight > window.innerHeight + scrollTop) {
            top = rect.top - pickerHeight + scrollTop;
            if (top < scrollTop) {
                top = rect.bottom + scrollTop;
            }
        }

        this.picker.style.top = `${top + 5}px`;
        this.picker.style.left = `${left}px`;
        
        this.picker.style.display = 'block';
        this.isPickerVisible = true;

        this.updateCanvas();
        
        if (input.value) {
            this.setCurrentColor(input.value);
        }
    }

    setCurrentColor(color) {
        const presetButtons = this.picker.querySelectorAll('.nv-color-preset');
        presetButtons.forEach(button => {
            if (button.style.backgroundColor.toLowerCase() === color.toLowerCase()) {
                button.classList.add('selected');
            } else {
                button.classList.remove('selected');
            }
        });
    }

    destroy() {
        document.removeEventListener('click', this.handleDocumentClick.bind(this));
        if (this.picker && this.picker.parentNode) {
            this.picker.parentNode.removeChild(this.picker);
        }
    }
}

window.ColorFlow = ColorFlow;
