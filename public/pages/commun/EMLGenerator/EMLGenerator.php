<?php
namespace Commun\EMLGenerator;

use PHPMailer\PHPMailer\PHPMailer;

/**
 * Classe pour générer des fichiers EML compatibles avec Thunderbird
 */
class EMLGenerator
{
    private PHPMailer $mailer;

    /**
     * Initialise un nouvel email
     *
     * @param string $from Adresse de l'expéditeur
     * @param string $to Adresse du destinataire
     * @param string $subject Sujet de l'email
     */
    public function __construct()
    {
        $this->mailer          = new PHPMailer(true);
        $this->mailer->CharSet = 'UTF-8';
        $this->mailer->isHTML(false);
    }

    public function setFrom(string $from)
    {
        $this->mailer->setFrom($from);
    }

    public function setTo(string $to)
    {
        $this->mailer->addAddress($to);
    }

    public function setSubject(string $subject)
    {
        $this->mailer->Subject = $subject;
    }

    /**
     * Définit le contenu HTML et texte de l'email
     *
     * @param string $html HTML du message
     * @param string|null $alt Texte brut alternatif
     */
    public function setBody(string $html, ?string $alt = null): void
    {
        $this->mailer->Body    = $html;
        $this->mailer->AltBody = $alt ?? strip_tags($html);
    }

    /**
     * Ajoute une pièce jointe
     *
     * @param string $filePath Chemin vers le fichier
     * @param string|null $name Nom optionnel dans le mail
     */
    public function addAttachment(string $filePath, ?string $name = null): void
    {
        $this->mailer->addAttachment($filePath, $name);
    }

    /**
     * Génère le fichier .eml
     *
     * @param string $outputPath Chemin du fichier de sortie
     */
    public function generateEML(string $outputPath): void
    {
        // Force la génération du corps MIME
        if (! $this->mailer->preSend()) {
            throw new \RuntimeException("Impossible de générer le message EML : " . $this->mailer->ErrorInfo);
        }

        $emlContent = $this->mailer->getSentMIMEMessage();

        if (file_put_contents($outputPath, $emlContent) === false) {
            throw new \RuntimeException("Erreur lors de l'écriture du fichier : $outputPath");
        }
    }
}
