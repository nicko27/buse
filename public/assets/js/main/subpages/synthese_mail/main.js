function downloadMail(id) {
    const destUrl = window.WEB_PAGES + '/main/subpages/synthese_mail/mail.php';
    const form = document.createElement("form");
    form.method = "POST";
    form.action = destUrl;
    form.style.display = "none";

    const input = document.createElement("input");
    input.name = "id";
    input.value = id;
    form.appendChild(input);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
}