<?php
namespace Commun\Mail;

/**
 * Classe pour générer des fichiers EML à partir de templates Twig
 */
class EMLGenerator
{
    /**
     * @var \Twig\Environment Instance de Twig
     */
    private $twig;

    /**
     * @var string Chemin vers les templates Twig
     */
    private $templatePath;

    /**
     * @var string Nom du template pour emails simples
     */
    private $simpleEmailTemplate = 'simple_email.twig';

    /**
     * @var string Nom du template pour emails avec pièces jointes
     */
    private $attachmentEmailTemplate = 'email_with_attachments.twig';

    /**
     * @var string Encodage par défaut à utiliser
     */
    private $defaultCharset = 'UTF-8';

    /**
     * Constructeur
     *
     * @param \Twig\Environment $twig Instance de Twig configurée
     * @param string $templatePath Chemin vers les templates (optionnel)
     * @param string $charset Encodage à utiliser (défaut: UTF-8)
     */
    public function __construct(\Twig\Environment $twig, $templatePath = null, $charset = 'UTF-8')
    {
        $this->twig           = $twig;
        $this->templatePath   = $templatePath;
        $this->defaultCharset = $charset;

        // Si le chemin des templates est fourni, ajuster le chargeur de Twig
        if ($templatePath !== null) {
            $loader = new \Twig\Loader\FilesystemLoader($templatePath);
            $this->twig->setLoader($loader);
        }
    }

    /**
     * Génère un email simple au format EML
     *
     * @param string $from Adresse de l'expéditeur (avec nom optionnel)
     * @param array|string $to Destinataire(s)
     * @param string $subject Sujet du message
     * @param string $textContent Corps du message en texte brut
     * @param string $htmlContent Corps du message en HTML (optionnel)
     * @param array $options Options supplémentaires (cc, bcc, replyTo, headers, etc.)
     * @return string Contenu du fichier EML
     */
    public function createSimpleEmail($from, $to, $subject, $textContent, $htmlContent = '', array $options = [])
    {
        // Générer un boundary unique au format Thunderbird
        $boundary = $this->generateThunderbirdBoundary();

        // Préparer les destinataires
        $recipients = [
            'to' => $this->formatRecipients($to),
        ];

        // Ajouter les options supplémentaires
        if (isset($options['cc'])) {
            $recipients['cc'] = $this->formatRecipients($options['cc']);
        }

        if (isset($options['bcc'])) {
            $recipients['bcc'] = $this->formatRecipients($options['bcc']);
        }

        // Encoder le contenu en quoted-printable si nécessaire
        $textContent = $this->ensureQuotedPrintable($textContent);
        $htmlContent = $this->ensureQuotedPrintable($htmlContent);

        // Encoder le sujet selon la RFC 1342 (MIME)
        $encodedSubject = $this->encodeHeaderValue($subject);

        // Préparer les données pour le template
        $data = array_merge(
            [
                'from'           => $from,
                'subject'        => $subject,
                'encodedSubject' => $encodedSubject,
                'boundary'       => $boundary,
                'textContent'    => $textContent,
                'htmlContent'    => $htmlContent,
                'charset'        => $this->defaultCharset,
            ],
            $recipients
        );

        // Ajouter les options supplémentaires
        if (isset($options['replyTo'])) {
            $data['replyTo'] = $options['replyTo'];
        }

        if (isset($options['headers']) && is_array($options['headers'])) {
            $data['headers'] = $options['headers'];
        }

        // Rendre le template
        return $this->twig->render($this->simpleEmailTemplate, $data);
    }

    /**
     * Génère un email avec pièces jointes au format EML
     *
     * @param string $from Adresse de l'expéditeur (avec nom optionnel)
     * @param array|string $to Destinataire(s)
     * @param string $subject Sujet du message
     * @param string $textContent Corps du message en texte brut
     * @param string $htmlContent Corps du message en HTML (optionnel)
     * @param array $emlAttachments Pièces jointes EML [['name' => 'nom.eml', 'content' => 'contenu']]
     * @param array $otherAttachments Autres pièces jointes [['name' => 'nom.pdf', 'content' => 'contenu', 'type' => 'mime/type']]
     * @param array $options Options supplémentaires (cc, bcc, replyTo, headers, etc.)
     * @return string Contenu du fichier EML
     */
    public function createEmailWithAttachments($from, $to, $subject, $textContent, $htmlContent = '', array $emlAttachments = [], array $otherAttachments = [], array $options = [])
    {
        // Générer des boundaries uniques au format Thunderbird
        $mainBoundary = $this->generateThunderbirdBoundary();
        $altBoundary  = $this->generateThunderbirdBoundary();

        // Préparer les destinataires
        $recipients = [
            'to' => $this->formatRecipients($to),
        ];

        // Ajouter les options supplémentaires
        if (isset($options['cc'])) {
            $recipients['cc'] = $this->formatRecipients($options['cc']);
        }

        if (isset($options['bcc'])) {
            $recipients['bcc'] = $this->formatRecipients($options['bcc']);
        }

        // Encoder le contenu en quoted-printable si nécessaire
        $textContent = $this->ensureQuotedPrintable($textContent);
        $htmlContent = $this->ensureQuotedPrintable($htmlContent);

        // Encoder le sujet selon la RFC 1342 (MIME)
        $encodedSubject = $this->encodeHeaderValue($subject);

        // Préparer les pièces jointes EML (message/rfc822)
        $processedEmlAttachments = [];
        foreach ($emlAttachments as $attachment) {
            if (! isset($attachment['name'])) {
                $attachment['name'] = 'message.eml';
            }
            $processedEmlAttachments[] = $attachment;
        }

        // Préparer les pièces jointes binaires (encodage base64)
        $processedOtherAttachments = [];
        foreach ($otherAttachments as $attachment) {
            if (! isset($attachment['content_encoded']) || ! $attachment['content_encoded']) {
                $attachment['content'] = chunk_split(base64_encode($attachment['content']));
            }

            // S'assurer que le nom de fichier est correctement encodé pour MIME
            if (isset($attachment['name'])) {
                $attachment['encoded_name'] = $this->encodeFileName($attachment['name']);
            }

            $processedOtherAttachments[] = $attachment;
        }

        // Préparer les données pour le template
        $data = array_merge(
            [
                'from'             => $from,
                'subject'          => $subject,
                'encodedSubject'   => $encodedSubject,
                'main_boundary'    => $mainBoundary,
                'alt_boundary'     => $altBoundary,
                'textContent'      => $textContent,
                'htmlContent'      => $htmlContent,
                'emlAttachments'   => $processedEmlAttachments,
                'otherAttachments' => $processedOtherAttachments,
                'charset'          => $this->defaultCharset,
            ],
            $recipients
        );

        // Ajouter les options supplémentaires
        if (isset($options['replyTo'])) {
            $data['replyTo'] = $options['replyTo'];
        }

        if (isset($options['headers']) && is_array($options['headers'])) {
            $data['headers'] = $options['headers'];
        }

        // Rendre le template
        return $this->twig->render($this->attachmentEmailTemplate, $data);
    }

    /**
     * Crée un modèle d'email à compléter (sans expéditeur)
     *
     * @param array|string $to Destinataire(s) (peut être vide)
     * @param string $subject Sujet du message
     * @param string $textContent Corps du message en texte brut
     * @param string $htmlContent Corps du message en HTML (optionnel)
     * @param array $options Options supplémentaires
     * @return string Contenu du fichier EML
     */
    public function createEmailTemplate($to, $subject, $textContent, $htmlContent = '', array $options = [])
    {
        // Utiliser la méthode createSimpleEmail sans expéditeur
        return $this->createSimpleEmail('', $to, $subject, $textContent, $htmlContent, $options);
    }

    /**
     * Crée un email de transfert (forward)
     *
     * @param string $from Adresse de l'expéditeur (avec nom optionnel)
     * @param array|string $to Destinataire(s)
     * @param string $subject Sujet du message (préfixé par "Fwd: " si nécessaire)
     * @param string $textIntro Texte d'introduction
     * @param string $originalEml Contenu du message à transférer
     * @param array $options Options supplémentaires
     * @return string Contenu du fichier EML
     */
    public function createForwardedEmail($from, $to, $subject, $textIntro, $originalEml, array $options = [])
    {
        // S'assurer que le sujet est préfixé par "Fwd: "
        if (strpos($subject, 'Fwd:') !== 0) {
            $subject = 'Fwd: ' . $subject;
        }

        // Créer un email avec pièce jointe EML
        $emlAttachments = [
            [
                'name'    => 'message_original.eml',
                'content' => $originalEml,
            ],
        ];

        // Créer un HTML simple pour le message d'introduction
        $htmlIntro = '<html><body><p>' . str_replace("\n", '<br>', htmlspecialchars($textIntro, ENT_QUOTES, $this->defaultCharset)) . '</p></body></html>';

        return $this->createEmailWithAttachments($from, $to, $subject, $textIntro, $htmlIntro, $emlAttachments, [], $options);
    }

    /**
     * Définir le nom du template pour emails simples
     *
     * @param string $templateName Nom du template
     * @return EMLGenerator
     */
    public function setSimpleEmailTemplate($templateName)
    {
        $this->simpleEmailTemplate = $templateName;
        return $this;
    }

    /**
     * Définir le nom du template pour emails avec pièces jointes
     *
     * @param string $templateName Nom du template
     * @return EMLGenerator
     */
    public function setAttachmentEmailTemplate($templateName)
    {
        $this->attachmentEmailTemplate = $templateName;
        return $this;
    }

    /**
     * Définir l'encodage à utiliser
     *
     * @param string $charset Nom de l'encodage (UTF-8, ISO-8859-1, etc.)
     * @return EMLGenerator
     */
    public function setCharset($charset)
    {
        $this->defaultCharset = $charset;
        return $this;
    }

    /**
     * Génère un boundary au format Thunderbird
     *
     * @return string Boundary
     */
    private function generateThunderbirdBoundary()
    {
        $chars    = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        $boundary = '';
        for ($i = 0; $i < 16; $i++) {
            $boundary .= $chars[rand(0, strlen($chars) - 1)];
        }

        return '--------------' . $boundary;
    }

    /**
     * Formate les destinataires en tableau
     *
     * @param array|string $recipients Destinataire(s)
     * @return array Tableau de destinataires
     */
    private function formatRecipients($recipients)
    {
        if (is_string($recipients)) {
            return [$recipients];
        }

        return $recipients;
    }

    /**
     * Encode un en-tête selon la norme MIME (RFC 1342)
     *
     * @param string $value Valeur à encoder
     * @param string $encoding Méthode d'encodage (B pour Base64, Q pour Quoted-Printable)
     * @return string Valeur encodée
     */
    private function encodeHeaderValue($value, $encoding = 'B')
    {
        // Vérifier si l'encodage est nécessaire
        if (preg_match('/[^\x20-\x7E]/', $value)) {
            // Contient des caractères non-ASCII, encodage nécessaire
            $encoding = strtoupper($encoding);

            if ($encoding === 'B') {
                // Encodage Base64
                return '=?' . $this->defaultCharset . '?B?' . base64_encode($value) . '?=';
            } else {
                // Encodage Quoted-Printable
                return '=?' . $this->defaultCharset . '?Q?' . str_replace(' ', '_', quoted_printable_encode($value)) . '?=';
            }
        }

        return $value;
    }

    /**
     * Encode un nom de fichier pour les pièces jointes
     *
     * @param string $fileName Nom du fichier
     * @return string Nom du fichier encodé
     */
    private function encodeFileName($fileName)
    {
        return $this->encodeHeaderValue($fileName, 'B');
    }

    /**
     * S'assure que le contenu est encodé en quoted-printable
     *
     * @param string $content Contenu à encoder
     * @return string Contenu encodé
     */
    private function ensureQuotedPrintable($content)
    {
        // Vérification plus robuste pour déterminer si l'encodage est nécessaire
        $needsEncoding = false;

        // Vérifier la présence de caractères non-ASCII
        if (preg_match('/[^\x20-\x7E]/', $content)) {
            $needsEncoding = true;
        }

        // Vérifier les lignes de plus de 76 caractères
        $lines = explode("\n", str_replace("\r\n", "\n", $content));
        foreach ($lines as $line) {
            if (strlen($line) > 76) {
                $needsEncoding = true;
                break;
            }
        }

        // Vérifier la présence de caractères qui doivent être échappés en Quoted-Printable
        if (strpos($content, '=') !== false ||
            strpos($content, '.') === 0 ||
            substr($content, -1) === ' ' ||
            strpos($content, "\t") !== false) {
            $needsEncoding = true;
        }

        if ($needsEncoding) {
            // S'assurer que l'entrée est en UTF-8 avant d'encoder
            if (function_exists('mb_detect_encoding') && mb_detect_encoding($content, 'UTF-8', true) === false) {
                // La chaîne n'est pas en UTF-8, essayer de la convertir
                if (function_exists('mb_convert_encoding')) {
                    $content = mb_convert_encoding($content, 'UTF-8');
                }
            }

            return quoted_printable_encode($content);
        }

        return $content;
    }

    /**
     * Lit un fichier EML et extrait ses propriétés
     *
     * @param string $emlContent Contenu du fichier EML
     * @return array Propriétés du message EML
     */
    public function parseEML($emlContent)
    {
        $result = [
            'headers'     => [],
            'textContent' => '',
            'htmlContent' => '',
            'attachments' => [],
        ];

        // Séparer les en-têtes et le corps
        $parts = explode("\r\n\r\n", $emlContent, 2);
        if (count($parts) < 2) {
            // Format non valide
            return $result;
        }

        $headers = $parts[0];
        $body    = $parts[1];

        // Analyser les en-têtes
        $headerLines   = explode("\r\n", $headers);
        $currentHeader = '';

        foreach ($headerLines as $line) {
            if (preg_match('/^([A-Za-z\-]+):(.*)$/', $line, $matches)) {
                $currentHeader                     = trim($matches[1]);
                $result['headers'][$currentHeader] = trim($matches[2]);
            } elseif (! empty($currentHeader) && preg_match('/^\s+(.+)$/', $line, $matches)) {
                // Continuation d'en-tête
                $result['headers'][$currentHeader] .= ' ' . trim($matches[1]);
            }
        }

        // Extraire les parties du message
        $this->extractMessageParts($emlContent, $result);

        return $result;
    }

    /**
     * Extrait les parties d'un message MIME
     *
     * @param string $emlContent Contenu du message EML
     * @param array &$result Résultat de l'analyse (passé par référence)
     */
    private function extractMessageParts($emlContent, &$result)
    {
        // Rechercher le boundary si c'est un message multipart
        if (isset($result['headers']['Content-Type']) &&
            preg_match('/boundary="([^"]+)"/', $result['headers']['Content-Type'], $matches)) {

            $boundary = $matches[1];
            $parts    = explode('--' . $boundary, $emlContent);

            // Ignorer la première partie (avant le boundary)
            for ($i = 1; $i < count($parts) - 1; $i++) {
                $part = $parts[$i];

                // Analyser chaque partie
                $this->analyzePart($part, $result);
            }
        } else {
            // Message non multipart
            $result['textContent'] = $emlContent;
        }
    }

    /**
     * Analyse une partie d'un message MIME
     *
     * @param string $part Contenu de la partie
     * @param array &$result Résultat de l'analyse (passé par référence)
     */
    private function analyzePart($part, &$result)
    {
        // Séparer les en-têtes et le contenu de la partie
        $partSections = explode("\r\n\r\n", $part, 2);
        if (count($partSections) < 2) {
            return;
        }

        $partHeaders = $partSections[0];
        $partContent = $partSections[1];

        // Extraire le type de contenu
        $contentType = '';
        if (preg_match('/Content-Type:\s*([^;\r\n]+)/i', $partHeaders, $matches)) {
            $contentType = strtolower(trim($matches[1]));
        }

        // Extraire le charset
        $charset = $this->defaultCharset;
        if (preg_match('/charset=([^;\r\n"]+)/i', $partHeaders, $matches)) {
            $charset = trim($matches[1], '"\'');
        }

        // Extraire l'encodage
        $encoding = '';
        if (preg_match('/Content-Transfer-Encoding:\s*([^\r\n]+)/i', $partHeaders, $matches)) {
            $encoding = strtolower(trim($matches[1]));
        }

        // Décoder le contenu selon l'encodage
        switch ($encoding) {
            case 'quoted-printable':
                $partContent = quoted_printable_decode($partContent);
                break;

            case 'base64':
                $partContent = base64_decode($partContent);
                break;
        }

        // Convertir le contenu au charset UTF-8 si nécessaire
        if (function_exists('mb_convert_encoding') && $charset !== 'UTF-8' && $charset !== '') {
            $partContent = mb_convert_encoding($partContent, 'UTF-8', $charset);
        }

        // Traiter selon le type de contenu
        if ($contentType === 'text/plain') {
            $result['textContent'] = $partContent;
        } elseif ($contentType === 'text/html') {
            $result['htmlContent'] = $partContent;
        } elseif (strpos($contentType, 'multipart/') === 0) {
            // Partie multipart imbriquée, récursivement analyser
            if (preg_match('/boundary="([^"]+)"/', $partHeaders, $matches)) {
                $subBoundary = $matches[1];
                $subParts    = explode('--' . $subBoundary, $partContent);

                for ($i = 1; $i < count($subParts) - 1; $i++) {
                    $this->analyzePart($subParts[$i], $result);
                }
            }
        } elseif ($contentType === 'message/rfc822') {
            // Pièce jointe EML
            $name = 'message.eml';
            if (preg_match('/name="([^"]+)"/i', $partHeaders, $matches)) {
                $name = $matches[1];
            } elseif (preg_match('/filename="([^"]+)"/i', $partHeaders, $matches)) {
                $name = $matches[1];
            }

            $result['attachments'][] = [
                'name'    => $name,
                'type'    => $contentType,
                'content' => $partContent,
                'isEml'   => true,
            ];
        } else {
            // Autre pièce jointe
            $name = '';
            if (preg_match('/name="([^"]+)"/i', $partHeaders, $matches)) {
                $name = $matches[1];
            } elseif (preg_match('/filename="([^"]+)"/i', $partHeaders, $matches)) {
                $name = $matches[1];
            }

            if (! empty($name)) {
                $result['attachments'][] = [
                    'name'    => $name,
                    'type'    => $contentType,
                    'content' => $partContent,
                    'isEml'   => false,
                ];
            }
        }
    }
}
