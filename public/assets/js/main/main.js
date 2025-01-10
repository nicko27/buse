function actionRow(php, rowData, table, action) {
    console.log('actionRow called with:', { php, rowData, table, action });
    php = window.WEB_PAGES + php;
    console.log('php', php);

    return new Promise((resolve, reject) => {
        // Prépare les données pour l'API PHP
        const formData = new FormData();
        for (const key in rowData) {
            formData.append(key, rowData[key]);
            console.log('Adding to formData:', key, rowData[key]);
        }
        formData.append("action", action);
        formData.append("table", table);

        // Appelle la fonction ajaxFct pour envoyer la requête
        ajaxFct(formData, php)
            .then((response) => {
                console.log('API Response:', response);
                if (response && response.error === 0) {
                    // Succès de l'API
                    resolve(true);
                } else {
                    resolve(false);
                    console.log("reject:" + response);
                }
            })
            .catch((error) => {
                console.error('API Error:', error);
                resolve(false);
                console.log("catch:" + error);
            });
    });
}
