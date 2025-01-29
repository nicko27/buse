/**
 * DateFlow - Gestionnaire moderne de sélection de dates
 * @class
 */
class DateFlow {
    // Constantes pour la configuration du calendrier
    static DAYS_IN_WEEK = 7;
    static WEEKS_TO_DISPLAY = 6;
    static TOTAL_DAYS = DateFlow.DAYS_IN_WEEK * DateFlow.WEEKS_TO_DISPLAY;
    static DEFAULT_TIME_INTERVAL = 15;
    static DEFAULT_FORMAT = 'DD.MM.YYYY';

    /**
     * Initialise le DateFlow
     * @param {Object} config Configuration initiale
     * @throws {Error} Si la configuration est invalide
     */
    constructor(config = {}) {
        this.validateConfig(config);
        this.config = {
            timeInterval: config.timeInterval || DateFlow.DEFAULT_TIME_INTERVAL,
            firstDayOfWeek: config.firstDayOfWeek || 'monday',
            lang: config.lang || 'fr',
            format: config.format || DateFlow.DEFAULT_FORMAT,
            timeFormat: 'HH:mm',
            labels: {
                fr: {
                    days: ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'],
                    months: ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'],
                    today: "Aujourd'hui",
                    clear: 'Effacer',
                    close: 'Fermer',
                    selectTime: "Sélectionner l'heure",
                    hour: 'Heure',
                    minute: 'Minute',
                    error: {
                        invalidDate: 'Date invalide',
                        outOfRange: 'Date hors limites'
                    }
                },
                ...config.labels
            }
        };

        this.activeInstances = new Map();
        this.eventHandlers = new Map();
        this.init();
    }

    /**
     * Valide la configuration
     * @param {Object} config
     * @throws {Error} Si la configuration est invalide
     * @private
     */
    validateConfig(config) {
        if (config.timeInterval && (!Number.isInteger(config.timeInterval) || config.timeInterval < 1 || config.timeInterval > 60)) {
            throw new Error('L\'intervalle de temps doit être un entier entre 1 et 60');
        }
        if (config.firstDayOfWeek && !['monday', 'sunday'].includes(config.firstDayOfWeek)) {
            throw new Error('Le premier jour de la semaine doit être "monday" ou "sunday"');
        }
    }

    /**
     * Initialise les éléments
     * @private
     */
    init() {
        document.querySelectorAll('[dp-input]').forEach(element => {
            this.initElement(element);
        });

        // Gestionnaire de clic global pour fermer les pickers
        this._globalClickHandler = (e) => {
            this.activeInstances.forEach((picker, input) => {
                if (picker.style.display !== 'none') {
                    const isClickInside = picker.contains(e.target) || input.contains(e.target);
                    if (!isClickInside) {
                        this.hidePicker(picker);
                    }
                }
            });
        };

        document.addEventListener('click', this._globalClickHandler);
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
            format: element.getAttribute('dp-format') || (element.hasAttribute('dp-time-only') ? this.config.timeFormat : this.config.format),
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

        // Initialiser la date avec la valeur actuelle de l'input ou la date actuelle
        let initialDate = element.value ? this.parseDate(element.value, elementConfig) : new Date();
        if (initialDate) {
            // Ajuster les minutes selon l'intervalle
            const interval = elementConfig.timeInterval;
            const minutes = initialDate.getMinutes();
            const roundedMinutes = Math.round(minutes / interval) * interval;
            initialDate.setMinutes(roundedMinutes);
            element.value = this.formatDate(initialDate, elementConfig);
        }

        // Créer le picker
        const picker = this.createPicker(element, elementConfig);
        picker.config = elementConfig;
        picker.style.display = 'none';
        picker.classList.add('date-flow-picker');
        document.body.appendChild(picker);
        this.activeInstances.set(element, picker);

        // Gestionnaires d'événements
        const showPickerHandler = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showPicker(element);
        };

        element.addEventListener('click', showPickerHandler);
        element.addEventListener('focus', showPickerHandler);
        this.eventHandlers.set(element, showPickerHandler);
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
        if (config.showButtons) {
            picker.classList.add('with-buttons');
        }
        picker.linkedInput = input;
        picker.config = config;

        // Initialiser avec la date actuelle ou la valeur de l'input
        let currentDate = this.parseDate(input.value, config) || new Date();

        if (config.timeOnly) {
            picker.classList.add('time-only');
            this.createTimeSection(picker, currentDate);
        } else {
            if (!config.timeOnly) {
                this.createCalendarSection(picker, currentDate);
            }
            if (config.time) {
                this.createTimeSection(picker, currentDate);
            }
        }

        // Mettre à jour les inputs de temps avec la date actuelle
        this.updateTimeInputs(picker, currentDate);

        if (config.showButtons) {
            this.createButtonsSection(picker);
        }

        return picker;
    }

    /**
     * Crée le sélecteur de temps
     * @param {HTMLElement} picker
     * @param {Date} date
     * @private
     */
    createTimeSection(picker, date) {
        const timeSection = document.createElement('div');
        timeSection.classList.add('time-section');

        const timeInputs = document.createElement('div');
        timeInputs.classList.add('time-inputs');

        // Utiliser la date fournie, la valeur de l'input, ou la date actuelle
        const inputDate = this.parseDate(picker.linkedInput.value, picker.config);
        const currentDate = inputDate || date || new Date();

        const currentHours = currentDate.getHours();
        const currentMinutes = currentDate.getMinutes();
        const interval = picker.config.timeInterval || 15;

        // Arrondir les minutes à l'intervalle le plus proche
        const roundedMinutes = Math.round(currentMinutes / interval) * interval;

        // Heures
        const hoursContainer = document.createElement('div');
        hoursContainer.classList.add('time-input-container');
        const hoursLabel = document.createElement('label');
        hoursLabel.textContent = this.config.labels[this.config.lang].hour;
        const hoursInput = document.createElement('select');
        hoursInput.classList.add('time-input', 'hours');

        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i.toString().padStart(2, '0');
            if (i === currentHours) {
                option.selected = true;
            }
            hoursInput.appendChild(option);
        }

        hoursContainer.appendChild(hoursLabel);
        hoursContainer.appendChild(hoursInput);

        const separator = document.createElement('span');
        separator.textContent = ':';
        separator.style.margin = '0 4px';
        separator.style.color = '#666';

        // Minutes
        const minutesContainer = document.createElement('div');
        minutesContainer.classList.add('time-input-container');
        const minutesLabel = document.createElement('label');
        minutesLabel.textContent = this.config.labels[this.config.lang].minute;
        const minutesInput = document.createElement('select');
        minutesInput.classList.add('time-input', 'minutes');

        for (let i = 0; i < 60; i += interval) {
            const option = document.createElement('option');
            option.value = i.toString().padStart(2, '0');
            option.textContent = i.toString().padStart(2, '0');
            if (i === roundedMinutes) {
                option.selected = true;
            }
            minutesInput.appendChild(option);
        }

        minutesContainer.appendChild(minutesLabel);
        minutesContainer.appendChild(minutesInput);

        timeInputs.appendChild(hoursContainer);
        timeInputs.appendChild(separator);
        timeInputs.appendChild(minutesContainer);
        timeSection.appendChild(timeInputs);

        // Gestionnaires d'événements pour la mise à jour du temps
        const updateTime = () => {
            const hours = parseInt(hoursInput.value);
            const minutes = parseInt(minutesInput.value);
            const input = picker.linkedInput;
            let currentValue = this.parseDate(input.value, picker.config);

            // Si la valeur actuelle n'est pas valide, utiliser la date fournie ou la date actuelle
            if (!currentValue || isNaN(currentValue)) {
                currentValue = date || new Date();
            }

            currentValue.setHours(hours);
            currentValue.setMinutes(minutes);

            input.value = this.formatDate(currentValue, picker.config);
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        hoursInput.addEventListener('change', updateTime);
        minutesInput.addEventListener('change', updateTime);

        picker.appendChild(timeSection);
    }

    /**
     * Crée la section du calendrier
     * @param {HTMLElement} picker
     * @param {Date} date
     * @private
     */
    createCalendarSection(picker, date) {
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
    }

    /**
     * Crée la section des boutons
     * @param {HTMLElement} picker
     * @private
     */
    createButtonsSection(picker) {
        const buttonsContainer = document.createElement('div');
        buttonsContainer.classList.add('date-flow-buttons');

        const todayButton = document.createElement('button');
        todayButton.type = 'button';
        todayButton.classList.add('date-flow-today');
        todayButton.textContent = this.config.labels[this.config.lang].today;
        todayButton.addEventListener('click', () => {
            const today = new Date();
            if (this.config.min && today < this.config.min) return;
            if (this.config.max && today > this.config.max) return;
            this.selectDate(picker, today);
        });
        buttonsContainer.appendChild(todayButton);

        const clearButton = document.createElement('button');
        clearButton.type = 'button';
        clearButton.classList.add('date-flow-clear');
        clearButton.textContent = this.config.labels[this.config.lang].clear;
        clearButton.addEventListener('click', () => {
            picker.linkedInput.value = '';
            this.hidePicker(picker);
        });
        buttonsContainer.appendChild(clearButton);

        picker.appendChild(buttonsContainer);
    }

    /**
     * Met à jour les inputs de temps
     * @param {HTMLElement} picker
     * @param {Date} date
     * @private
     */
    updateTimeInputs(picker, date) {
        if (!picker || !date || !(date instanceof Date) || isNaN(date)) return;

        const hoursInput = picker.querySelector('.time-input.hours');
        const minutesInput = picker.querySelector('.time-input.minutes');

        if (hoursInput && minutesInput) {
            const hours = date.getHours();
            const minutes = date.getMinutes();
            const interval = picker.config.timeInterval || 15;

            // Arrondir les minutes à l'intervalle le plus proche
            const roundedMinutes = Math.round(minutes / interval) * interval;

            hoursInput.value = hours.toString().padStart(2, '0');
            minutesInput.value = (roundedMinutes % 60).toString().padStart(2, '0');

            // Mettre à jour l'input avec la nouvelle valeur
            const input = picker.linkedInput;
            if (input && input.value) {
                const currentDate = this.parseDate(input.value, picker.config);
                if (currentDate) {
                    currentDate.setHours(hours);
                    currentDate.setMinutes(roundedMinutes);
                    input.value = this.formatDate(currentDate, picker.config);
                }
            }
        }
    }

    /**
     * Affiche le picker
     * @param {HTMLElement} input
     * @private
     */
    showPicker(input) {
        if (!input) return;

        const picker = this.getPicker(input);
        if (!picker) return;

        // Utiliser la date de l'input si elle existe et valide, sinon utiliser la date actuelle
        let currentDate = input.value ? this.parseDate(input.value, picker.config) : new Date();
        if (!currentDate || isNaN(currentDate)) {
            currentDate = new Date();
        }

        // Mettre à jour le calendrier et les inputs de temps
        if (!picker.config.timeOnly) {
            this.updateCalendar(picker, currentDate);
        }
        this.updateTimeInputs(picker, currentDate);

        // Positionner et afficher le picker
        picker.style.position = 'absolute';
        picker.style.zIndex = '10000';
        this.positionPicker(picker, input);
        
        // Afficher le picker avec animation
        picker.style.display = 'block';
        // Forcer un reflow pour que la transition fonctionne
        picker.offsetHeight;
        picker.classList.add('visible');

        // Fermer les autres pickers
        this.activeInstances.forEach((otherPicker) => {
            if (otherPicker !== picker) {
                this.hidePicker(otherPicker);
            }
        });
    }

    /**
     * Positionne le picker par rapport à l'input
     * @param {HTMLElement} picker
     * @param {HTMLElement} input
     * @private
     */
    positionPicker(picker, input) {
        const inputRect = input.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        let top = inputRect.bottom + scrollTop;
        let left = inputRect.left + scrollLeft;

        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
    }

    /**
     * Cache le picker
     * @param {HTMLElement} picker
     * @private
     */
    hidePicker(picker) {
        if (!picker) return;
        picker.classList.remove('visible');
        setTimeout(() => {
            picker.style.display = 'none';
        }, 300); // Correspond à la durée de la transition CSS
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
        if (!date) return;

        const currentDate = date instanceof Date && !isNaN(date) ? date : new Date();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const selectedDate = this.parseDate(picker.linkedInput.value, picker.config);

        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();

        // Mettre à jour le titre
        const title = picker.querySelector('.date-flow-month-year');
        title.textContent = `${this.config.labels[this.config.lang].months[month]} ${year}`;

        // Créer ou mettre à jour la grille des jours
        let calendar = picker.querySelector('.date-flow-calendar');
        if (!calendar) {
            calendar = document.createElement('div');
            calendar.classList.add('date-flow-calendar');
            picker.appendChild(calendar);
        } else {
            calendar.innerHTML = '';
        }

        // Créer l'en-tête des jours de la semaine
        const weekdays = document.createElement('div');
        weekdays.classList.add('date-flow-weekdays');
        this.config.labels[this.config.lang].days.forEach(day => {
            const dayEl = document.createElement('div');
            dayEl.classList.add('date-flow-weekday');
            dayEl.textContent = day;
            weekdays.appendChild(dayEl);
        });
        calendar.appendChild(weekdays);

        // Créer la grille des jours
        const grid = document.createElement('div');
        grid.classList.add('date-flow-days');
        calendar.appendChild(grid);

        // Obtenir le premier jour du mois
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        // Calculer le début et la fin de la grille
        let start = new Date(firstDay);
        start.setDate(start.getDate() - start.getDay());
        if (this.config.firstDayOfWeek === 'monday') {
            if (start.getDay() === 0) {
                start.setDate(start.getDate() - 6);
            } else {
                start.setDate(start.getDate() - (start.getDay() - 1));
            }
        }

        // Créer les cellules de la grille
        for (let i = 0; i < 42; i++) {
            const cellDate = new Date(start);
            cellDate.setDate(start.getDate() + i);
            cellDate.setHours(0, 0, 0, 0);

            const dayEl = document.createElement('button');
            dayEl.type = 'button';
            dayEl.classList.add('date-flow-day');
            dayEl.textContent = cellDate.getDate();

            // Vérifier si la date est désactivée
            const isDisabled = (picker.config.min && cellDate < picker.config.min) ||
                (picker.config.max && cellDate > picker.config.max);

            if (isDisabled) {
                dayEl.disabled = true;
                dayEl.setAttribute('aria-disabled', 'true');
            }

            // Ajouter les classes appropriées
            if (cellDate.getMonth() !== month) {
                dayEl.classList.add('date-flow-adjacent-month');
            }

            // Vérifier si c'est aujourd'hui
            if (cellDate.getTime() === today.getTime()) {
                dayEl.classList.add('date-flow-today');
                dayEl.setAttribute('aria-current', 'date');
            }

            // Vérifier si c'est la date sélectionnée
            if (selectedDate) {
                const normalizedSelectedDate = new Date(selectedDate);
                normalizedSelectedDate.setHours(0, 0, 0, 0);
                if (cellDate.getTime() === normalizedSelectedDate.getTime()) {
                    dayEl.classList.add('date-flow-selected');
                    dayEl.setAttribute('aria-selected', 'true');
                }
            }

            // Ajouter le gestionnaire de clic
            dayEl.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const newDate = new Date(cellDate);
                this.selectDate(picker, newDate);
            });

            grid.appendChild(dayEl);
        }
    }

    /**
     * Sélectionne une date
     * @param {HTMLElement} picker
     * @param {Date} date
     * @private
     */
    selectDate(picker, date) {
        if (!picker || !date) return;

        // Vérifier les limites min/max
        if (picker.config.min && date < picker.config.min) return;
        if (picker.config.max && date > picker.config.max) return;

        // Récupérer l'heure actuelle si elle existe
        let currentTime = { hours: 0, minutes: 0 };
        if (picker.config.time) {
            const timeSection = picker.querySelector('.time-section');
            if (timeSection) {
                const hoursInput = timeSection.querySelector('.hours');
                const minutesInput = timeSection.querySelector('.minutes');
                if (hoursInput && minutesInput) {
                    currentTime.hours = parseInt(hoursInput.value) || 0;
                    currentTime.minutes = parseInt(minutesInput.value) || 0;
                }
            }
        }

        // Appliquer l'heure à la nouvelle date
        const selectedDate = new Date(date);
        selectedDate.setHours(currentTime.hours);
        selectedDate.setMinutes(currentTime.minutes);

        // Mettre à jour l'input
        picker.linkedInput.value = this.formatDate(selectedDate, picker.config);
        picker.linkedInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Mettre à jour le calendrier
        this.updateCalendar(picker, selectedDate);

        // Fermer le picker si pas de sélection de temps
        if (!picker.config.time) {
            this.hidePicker(picker);
        }
    }

    /**
     * Formate une date
     * @param {Date} date
     * @param {Object} config
     * @returns {string}
     * @private
     */
    formatDate(date, config = this.config) {
        if (!date || !(date instanceof Date) || isNaN(date)) return '';

        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');

        if (config.timeOnly) {
            return `${hours}:${minutes}`;
        }

        const datePart = `${day}.${month}.${year}`;
        return config.time ? `${datePart} ${hours}:${minutes}` : datePart;
    }

    /**
     * Parse une date
     * @param {string} dateStr
     * @param {Object} config
     * @returns {Date|null}
     * @private
     */
    parseDate(dateStr, config) {
        if (!dateStr) return null;

        // Séparer la date et l'heure
        const [datePart, timePart] = dateStr.split(' ');
        if (!datePart) return null;

        // Parser la date
        const [day, month, year] = datePart.split('.');
        if (!day || !month || !year) return null;

        // Créer la date
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

        // Ajouter l'heure si elle existe
        if (timePart) {
            const [hours, minutes] = timePart.split(':');
            if (hours && minutes) {
                date.setHours(parseInt(hours));
                date.setMinutes(parseInt(minutes));
            }
        }

        return date;
    }

    /**
     * Valide l'année
     * @param {string|number} year
     * @returns {number|null}
     * @private
     */
    validateYear(year) {
        const numYear = parseInt(year);
        if (isNaN(numYear)) return null;

        // Gestion des années à 2 chiffres
        if (String(year).length === 2) {
            return 2000 + numYear;
        }

        // Validation basique de l'année
        return (numYear >= 1900 && numYear <= 9999) ? numYear : null;
    }

    /**
     * Valide le mois
     * @param {string|number} month
     * @returns {number|null}
     * @private
     */
    validateMonth(month) {
        const numMonth = parseInt(month);
        return (numMonth >= 1 && numMonth <= 12) ? numMonth : null;
    }

    /**
     * Valide le jour
     * @param {string|number} day
     * @param {number} month
     * @param {number} year
     * @returns {number|null}
     * @private
     */
    validateDay(day, month, year) {
        const numDay = parseInt(day);
        if (isNaN(numDay)) return null;

        const lastDayOfMonth = new Date(year, month, 0).getDate();
        return (numDay >= 1 && numDay <= lastDayOfMonth) ? numDay : null;
    }

    /**
     * Valide les heures
     * @param {string|number} hours
     * @returns {number}
     * @private
     */
    validateHours(hours) {
        const numHours = parseInt(hours) || 0;
        return Math.max(0, Math.min(23, numHours));
    }

    /**
     * Valide les minutes
     * @param {string|number} minutes
     * @param {number} interval
     * @returns {number}
     * @private
     */
    validateMinutes(minutes, interval) {
        const numMinutes = parseInt(minutes) || 0;
        const validMinutes = Math.max(0, Math.min(59, numMinutes));
        return Math.round(validMinutes / interval) * interval;
    }

    /**
     * Passe au mois précédent
     * @param {HTMLElement} picker
     * @private
     */
    prevMonth(picker) {
        const currentDate = this.parseDate(picker.linkedInput.value, this.config) || new Date();
        currentDate.setMonth(currentDate.getMonth() - 1);
        this.updateCalendar(picker, currentDate);
    }

    /**
     * Passe au mois suivant
     * @param {HTMLElement} picker
     * @private
     */
    nextMonth(picker) {
        const currentDate = this.parseDate(picker.linkedInput.value, this.config) || new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        this.updateCalendar(picker, currentDate);
    }

    /**
     * Met à jour la valeur de l'input
     * @param {HTMLElement} picker
     * @private
     */
    updateInputValue(picker) {
        if (!picker || !picker.linkedInput) return;

        const input = picker.linkedInput;
        const config = picker.config;

        // Obtenir la date actuelle du picker
        let currentDate = this.parseDate(input.value, config) || new Date();

        // Mettre à jour l'heure si les inputs de temps existent
        if (config.time) {
            const timeSection = picker.querySelector('.time-section');
            if (timeSection) {
                const hoursInput = timeSection.querySelector('.hours');
                const minutesInput = timeSection.querySelector('.minutes');

                if (hoursInput && minutesInput) {
                    const hours = parseInt(hoursInput.value) || 0;
                    const minutes = parseInt(minutesInput.value) || 0;

                    currentDate.setHours(hours);
                    currentDate.setMinutes(minutes);
                }
            }
        }

        // Formater et mettre à jour la valeur de l'input
        input.value = this.formatDate(currentDate, config);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    /**
     * Nettoie les ressources
     * @public
     */
    destroy() {
        // Supprimer tous les pickers
        this.activeInstances.forEach((picker) => {
            if (picker && picker.parentNode) {
                picker.parentNode.removeChild(picker);
            }
        });

        // Supprimer tous les gestionnaires d'événements
        this.eventHandlers.forEach((handler, element) => {
            if (element) {
                element.removeEventListener('click', handler);
                element.removeEventListener('focus', handler);
            }
        });

        // Nettoyer les collections
        this.activeInstances.clear();
        this.eventHandlers.clear();

        // Supprimer le gestionnaire de clic global
        if (this._globalClickHandler) {
            document.removeEventListener('click', this._globalClickHandler);
            this._globalClickHandler = null;
        }
    }
}

// Export pour différents environnements
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DateFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], function () { return DateFlow; });
} else if (typeof window !== 'undefined') {
    window.DateFlow = DateFlow;
} else if (typeof global !== 'undefined') {
    global.DateFlow = DateFlow;
}
