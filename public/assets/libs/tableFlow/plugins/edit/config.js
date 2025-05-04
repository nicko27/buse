export const config = {
    name: 'edit',
    version: '1.0.0',
    dependencies: ['texteditor'],
    options: {
        editClass: 'editable',
        editingClass: 'editing',
        saveOnBlur: true,
        saveOnEnter: true,
        cancelOnEscape: true,
        autoFocus: true,
        inputTypes: {
            text: 'text',
            number: 'number',
            email: 'email',
            date: 'date',
            time: 'time',
            datetime: 'datetime-local',
            url: 'url',
            tel: 'tel',
            password: 'password'
        },
        defaultInputType: 'text',
        inputAttributes: {
            class: 'tableflow-input',
            spellcheck: 'false'
        }
    }
}; 