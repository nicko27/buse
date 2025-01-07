function actionRow(php, rowData, table, action) {
    return new Promise((resolve, reject) => {
        // Prépare les données pour l'API PHP
        const formData = new FormData();
        for (const key in rowData) {
            formData.append(key, rowData[key]);
        }
        formData.append("action", action);
        formData.append("table", table);


        // Appelle la fonction ajaxFct pour envoyer la requête
        ajaxFct(formData, php)
            .then((response) => {
                if (response && response.error === 0) {
                    // Succès de l'API
                    resolve(true);
                } else {
                    resolve(false);
                    console.log("reject:" + response);
                }
            })
            .catch((error) => {
                resolve(false);
                console.log("catch:" + error);
            });
    });
}
