/**
 * DateFlow - Gestionnaire moderne de sélection de dates
 * @class
 */
class DateFlow {
    /**
     * Initialise le DateFlow
     * @param {Object} config 
     */
    constructor(config = {}) {
        this.config = {
            timeInterval: config.timeInterval || 15,
            firstDayOfWeek: 'monday',
            lang: config.lang || 'fr',
            labels: {
                fr: {
                    days: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
                    months: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
                    today: "Aujourd'hui",
                    clear: 'Effacer',
                    close: 'Fermer',
                    selectTime: "Sélectionner l'heure",
                    hour: 'Heure',
                    minute: 'Minute'
                },
                ...config.labels
            }
        };

        this.activeInstances = new Map();
        this.eventHandlers = new Map();
        this.init();
    }

    /**
     * Initialise les éléments
     * @private
     */
    init() {
        document.querySelectorAll('[dp-input]').forEach(element => {
            this.initElement(element);
        });
    }

    /**
     * Initialise un élément
     * @param {HTMLElement} element 
     * @private
     */
    initElement(element) {
        // Vérifier que l'élément est dans un conteneur .date-flow
        let container = element.closest('.date-flow');
        if (!container) {
            console.warn('DateFlow: L\'élément doit être dans un conteneur avec la classe .date-flow');
            return;
        }

        const elementConfig = {
            time: element.hasAttribute('dp-time'),
            timeOnly: element.hasAttribute('dp-time-only'),
            timeInterval: parseInt(element.getAttribute('dp-time-interval')) || this.config.timeInterval,
            format: element.getAttribute('dp-format') || 'YYYY-MM-DD',
            min: element.getAttribute('dp-min'),
            max: element.getAttribute('dp-max'),
            showButtons: element.hasAttribute('dp-show-buttons'),
            lang: this.config.lang,
            labels: this.config.labels,
            firstDayOfWeek: this.config.firstDayOfWeek
        };

        // Valider les dates min/max
        if (elementConfig.min) {
            elementConfig.min = this.parseDate(elementConfig.min, elementConfig);
        }
        if (elementConfig.max) {
            elementConfig.max = this.parseDate(elementConfig.max, elementConfig);
        }

        // Initialiser la date
        let initialDate = null;
        const defaultDate = element.getAttribute('dp-date');
        if (defaultDate) {
            initialDate = this.parseDate(defaultDate, elementConfig);
            if (initialDate) {
                // Vérifier les limites min/max
                if (elementConfig.min && initialDate < elementConfig.min) {
                    initialDate = new Date(elementConfig.min);
                }
                if (elementConfig.max && initialDate > elementConfig.max) {
                    initialDate = new Date(elementConfig.max);
                }
                element.value = this.formatDate(initialDate, elementConfig);
            }
        }

        // Créer le picker
        const picker = this.createPicker(element, elementConfig);
        picker.style.display = 'none';
        document.body.appendChild(picker);
        this.activeInstances.set(element, picker);

        // Gestionnaires d'événements
        const showPicker = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showPicker(element);
        };

        element.addEventListener('click', showPicker);
        element.addEventListener('focus', showPicker);

        // Gestionnaire de clic global pour fermer le picker
        if (!this._globalClickHandler) {
            this._globalClickHandler = (e) => {
                const openPickers = Array.from(this.activeInstances.values())
                    .filter(p => p.style.display !== 'none');
                
                openPickers.forEach(p => {
                    if (!p.contains(e.target) && e.target !== p.linkedInput) {
                        this.hidePicker(p);
                    }
                });
            };
            document.addEventListener('click', this._globalClickHandler);
        }
    }

    /**
     * Crée le picker
     * @param {HTMLElement} input 
     * @param {Object} config 
     * @returns {HTMLElement}
     * @private
     */
    createPicker(input, config) {
        const picker = document.createElement('div');
        picker.classList.add('date-flow-picker');
        picker.linkedInput = input;
        picker.config = config;

        // Création de l'en-tête du calendrier
        const header = document.createElement('div');
        header.classList.add('date-flow-header');

        const prevButton = document.createElement('button');
        prevButton.type = 'button';
        prevButton.classList.add('date-flow-prev');
        prevButton.innerHTML = '&lt;';
        prevButton.addEventListener('click', () => this.prevMonth(picker));

        const nextButton = document.createElement('button');
        nextButton.type = 'button';
        nextButton.classList.add('date-flow-next');
        nextButton.innerHTML = '&gt;';
        nextButton.addEventListener('click', () => this.nextMonth(picker));

        const monthYear = document.createElement('div');
        monthYear.classList.add('date-flow-month-year');

        header.appendChild(prevButton);
        header.appendChild(monthYear);
        header.appendChild(nextButton);
        picker.appendChild(header);

        // Calendrier
        const calendar = document.createElement('div');
        calendar.classList.add('date-flow-calendar');
        picker.appendChild(calendar);

        // Section temps si nécessaire
        if (config.time || config.timeOnly) {
            this.initTimeSelection(picker);
        }

        // Ajouter les boutons si nécessaire
        if (config.showButtons) {
            const buttonsContainer = document.createElement('div');
            buttonsContainer.classList.add('date-flow-buttons');

            const todayButton = document.createElement('button');
            todayButton.type = 'button';
            todayButton.classList.add('date-flow-today');
            todayButton.textContent = config.labels[config.lang].today;
            todayButton.addEventListener('click', () => {
                const today = new Date();
                if (config.min && today < config.min) return;
                if (config.max && today > config.max) return;
                this.selectDate(picker, today);
            });

            const clearButton = document.createElement('button');
            clearButton.type = 'button';
            clearButton.classList.add('date-flow-clear');
            clearButton.textContent = config.labels[config.lang].clear;
            clearButton.addEventListener('click', () => {
                input.value = '';
                this.hidePicker(picker);
            });

            buttonsContainer.appendChild(todayButton);
            buttonsContainer.appendChild(clearButton);
            picker.appendChild(buttonsContainer);
        }

        // Initialisation
        const defaultDate = input.getAttribute('dp-date');
        let initialDate = null;
        
        if (defaultDate) {
            initialDate = this.parseDate(defaultDate, config);
            if (initialDate && !isNaN(initialDate)) {
                input.value = this.formatDate(initialDate, config);
            }
        }

        this.updateCalendar(picker, initialDate || new Date());
        return picker;
    }

    /**
     * Crée le sélecteur de temps
     * @param {HTMLElement} picker 
     * @private
     */
    initTimeSelection(picker) {
        if (!picker.config.time && !picker.config.timeOnly) return;

        const timeSection = document.createElement('div');
        timeSection.classList.add('time-section');

        const timeInputs = document.createElement('div');
        timeInputs.classList.add('time-inputs');

        // Heures
        const hoursInput = document.createElement('select');
        hoursInput.classList.add('time-input', 'hours');
        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i.toString().padStart(2, '0');
            hoursInput.appendChild(option);
        }

        // Minutes
        const minutesInput = document.createElement('select');
        minutesInput.classList.add('time-input', 'minutes');
        const interval = picker.config.timeInterval || 15; // Intervalle par défaut de 15 minutes
        for (let i = 0; i < 60; i += interval) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i.toString().padStart(2, '0');
            minutesInput.appendChild(option);
        }

        // Séparateur
        const separator = document.createElement('span');
        separator.textContent = ':';

        timeInputs.appendChild(hoursInput);
        timeInputs.appendChild(separator);
        timeInputs.appendChild(minutesInput);
        timeSection.appendChild(timeInputs);

        // Gestionnaires d'événements
        const updateTime = () => {
            const hours = hoursInput.value;
            const minutes = minutesInput.value;
            const input = picker.linkedInput;
            let currentDate = this.parseDate(input.value, picker.config) || new Date();
            
            currentDate.setHours(parseInt(hours));
            currentDate.setMinutes(parseInt(minutes));
            
            input.value = this.formatDate(currentDate, picker.config);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        hoursInput.addEventListener('change', updateTime);
        minutesInput.addEventListener('change', updateTime);

        picker.appendChild(timeSection);
    }

    /**
     * Affiche le picker
     * @param {HTMLElement} input 
     * @private
     */
    showPicker(input) {
        const picker = this.getPicker(input);
        if (!picker) return;

        // Cacher tous les autres pickers
        this.activeInstances.forEach((p, el) => {
            if (el !== input) {
                this.hidePicker(p);
            }
        });

        // Positionner le picker
        const rect = input.getBoundingClientRect();
        const pickerHeight = picker.offsetHeight || 300;
        const windowHeight = window.innerHeight;
        const windowWidth = window.innerWidth;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        picker.style.display = 'block';
        picker.style.visibility = 'hidden';

        // Calculer la position verticale
        let top = rect.bottom + scrollTop;
        const spaceBelow = windowHeight - (rect.bottom - scrollTop);
        const spaceAbove = rect.top - scrollTop;

        if (spaceBelow < pickerHeight && spaceAbove > spaceBelow) {
            top = rect.top + scrollTop - pickerHeight;
        }

        // Calculer la position horizontale
        let left = rect.left + scrollLeft;
        const pickerWidth = picker.offsetWidth || 280;

        if (left + pickerWidth > windowWidth) {
            left = windowWidth - pickerWidth - 10;
        }
        if (left < 0) {
            left = 10;
        }

        // Appliquer les positions
        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
        picker.style.visibility = 'visible';
        picker.classList.add('visible');

        // Mettre à jour le calendrier
        const currentDate = this.parseDate(input.value, picker.config) || new Date();
        this.updateCalendar(picker, currentDate);

        // Mettre à jour les sélecteurs de temps si présents
        if (picker.config.time || picker.config.timeOnly) {
            const hoursInput = picker.querySelector('.time-input.hours');
            const minutesInput = picker.querySelector('.time-input.minutes');
            
            if (hoursInput && minutesInput) {
                hoursInput.value = currentDate.getHours().toString().padStart(2, '0');
                const minutes = currentDate.getMinutes();
                const interval = picker.config.timeInterval || 15;
                const roundedMinutes = Math.round(minutes / interval) * interval;
                minutesInput.value = roundedMinutes.toString().padStart(2, '0');
            }
        }
    }

    /**
     * Cache le picker
     * @param {HTMLElement} picker 
     * @private
     */
    hidePicker(picker) {
        if (!picker) return;
        picker.classList.remove('visible');
        picker.style.display = 'none';
    }

    /**
     * Récupère le picker associé à un input
     * @param {HTMLElement} input 
     * @private
     */
    getPicker(input) {
        return this.activeInstances.get(input);
    }

    /**
     * Met à jour le calendrier
     * @param {HTMLElement} picker 
     * @param {Date} date 
     * @private
     */
    updateCalendar(picker, date) {
        // S'assurer que la date est valide
        const currentDate = date instanceof Date && !isNaN(date) ? date : new Date();
        
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const today = new Date();
        const selectedDate = this.parseDate(picker.linkedInput.value, picker.config);

        // Mettre à jour le titre
        const title = picker.querySelector('.date-flow-month-year');
        title.textContent = `${picker.config.labels[picker.config.lang].months[month]} ${year}`;

        // Créer ou mettre à jour la grille des jours
        let calendar = picker.querySelector('.date-flow-calendar');
        if (!calendar) {
            calendar = document.createElement('div');
            calendar.classList.add('date-flow-calendar');
            picker.appendChild(calendar);
        }

        // Vider le calendrier
        calendar.innerHTML = '';

        // Créer l'en-tête des jours de la semaine
        const weekdays = document.createElement('div');
        weekdays.classList.add('date-flow-weekdays');
        picker.config.labels[picker.config.lang].days.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.classList.add('date-flow-weekday');
            dayEl.textContent = day;
            weekdays.appendChild(dayEl);
        });
        calendar.appendChild(weekdays);

        // Créer la grille des jours
        const days = document.createElement('div');
        days.classList.add('date-flow-days');

        // Obtenir le premier jour du mois
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Calculer le début et la fin de la grille
        let start = new Date(firstDay);
        start.setDate(start.getDate() - start.getDay());
        if (picker.config.firstDayOfWeek === 'monday') {
            if (start.getDay() === 0) {
                start.setDate(start.getDate() - 6);
            } else {
                start.setDate(start.getDate() + 1);
            }
        }

        // Générer 6 semaines de jours
        for (let i = 0; i < 42; i++) {
            const currentDate = new Date(start);
            currentDate.setDate(start.getDate() + i);
            
            const dayEl = document.createElement('button');
            dayEl.type = 'button';
            dayEl.classList.add('date-flow-day');
            dayEl.textContent = currentDate.getDate();

            // Vérifier si la date est désactivée
            const isDisabled = (picker.config.min && currentDate < picker.config.min) || 
                             (picker.config.max && currentDate > picker.config.max);
            
            if (isDisabled) {
                dayEl.disabled = true;
                dayEl.setAttribute('aria-disabled', 'true');
            } else {
                dayEl.addEventListener('click', () => this.selectDate(picker, new Date(currentDate)));
            }

            // Ajouter les classes appropriées
            if (currentDate.getMonth() !== month) {
                dayEl.classList.add('date-flow-adjacent-month');
            }
            
            if (currentDate.toDateString() === today.toDateString()) {
                dayEl.classList.add('date-flow-today');
            }
            
            if (selectedDate && currentDate.toDateString() === selectedDate.toDateString()) {
                dayEl.classList.add('date-flow-selected');
                dayEl.setAttribute('aria-selected', 'true');
            }

            days.appendChild(dayEl);
        }

        calendar.appendChild(days);
    }

    /**
     * Sélectionne une date
     * @param {HTMLElement} picker 
     * @param {Date} date 
     * @private
     */
    selectDate(picker, date) {
        if (!date) return;

        // Vérifier les limites min/max
        if (picker.config.min && date < picker.config.min) return;
        if (picker.config.max && date > picker.config.max) return;

        const currentValue = picker.linkedInput.value;
        const currentDate = this.parseDate(currentValue, picker.config);

        // Conserver l'heure si elle existe déjà
        if (currentDate && (picker.config.time || picker.config.timeOnly)) {
            date.setHours(currentDate.getHours(), currentDate.getMinutes());
        }

        picker.linkedInput.value = this.formatDate(date, picker.config);
        picker.linkedInput.dispatchEvent(new Event('change', { bubbles: true }));

        if (!picker.config.time && !picker.config.timeOnly) {
            this.hidePicker(picker);
        }
    }

    /**
     * Formate une date
     * @private
     */
    formatDate(date, config = this.config) {
        if (!date) return '';
        
        const pad = (num) => String(num).padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());

        let formatted = config.format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day);

        if (config.time || config.timeOnly) {
            formatted += ` ${hours}:${minutes}`;
        }

        return formatted;
    }

    /**
     * Parse une date
     * @param {string} value 
     * @param {Object} config 
     * @returns {Date|null}
     * @private
     */
    parseDate(value, config = this.config) {
        if (!value) return null;

        // Si c'est déjà une instance de Date
        if (value instanceof Date) return new Date(value);

        try {
            // Essayer d'abord le format standard ISO
            let date = new Date(value);
            if (!isNaN(date)) return date;

            // Sinon, essayer de parser selon le format configuré
            const format = config.format || 'YYYY-MM-DD';
            const parts = value.match(/\d+/g);
            
            if (!parts || parts.length < 3) return null;

            let year, month, day, hours = 0, minutes = 0;
            
            // Extraire les composants selon le format
            if (format.indexOf('YYYY') === 0) {
                [year, month, day] = parts;
            } else if (format.indexOf('DD') === 0) {
                [day, month, year] = parts;
            } else {
                [month, day, year] = parts;
            }

            // Ajuster l'année si nécessaire
            if (year.length === 2) {
                year = '20' + year;
            }

            // Extraire l'heure si présente
            if (parts.length > 3 && (config.time || config.timeOnly)) {
                hours = parseInt(parts[3]) || 0;
                minutes = parseInt(parts[4]) || 0;
            }

            // Créer la date
            const parsedDate = new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                hours,
                minutes
            );

            return !isNaN(parsedDate) ? parsedDate : null;
        } catch (e) {
            console.warn('Error parsing date:', e);
            return null;
        }
    }

    /**
     * Passe au mois précédent
     * @param {HTMLElement} picker 
     * @private
     */
    prevMonth(picker) {
        const currentDate = this.parseDate(picker.linkedInput.value, picker.config) || new Date();
        currentDate.setMonth(currentDate.getMonth() - 1);
        this.updateCalendar(picker, currentDate);
    }

    /**
     * Passe au mois suivant
     * @param {HTMLElement} picker 
     * @private
     */
    nextMonth(picker) {
        const currentDate = this.parseDate(picker.linkedInput.value, picker.config) || new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        this.updateCalendar(picker, currentDate);
    }

    /**
     * Nettoie les ressources
     * @public
     */
    destroy() {
        this.activeInstances.forEach((picker, element) => {
            const handlers = this.eventHandlers.get(element);
            if (handlers) {
                for (const [event, handler] of Object.entries(handlers)) {
                    if (event === 'clickOutside') {
                        document.removeEventListener('click', handler);
                    } else {
                        element.removeEventListener(event, handler);
                    }
                }
            }
            if (document.body.contains(picker)) {
                document.body.removeChild(picker);
            }
        });
        this.activeInstances.clear();
        this.eventHandlers.clear();
    }
}

// Export pour différents environnements
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], () => DateFlow);
} else {
    window.DateFlow = DateFlow;
}
