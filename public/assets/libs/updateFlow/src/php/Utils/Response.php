<?php
declare (strict_types = 1);

namespace UpdateFlow\Utils;

/**
 * Classe de réponse API
 */
class Response
{
    private int $statusCode;
    private string $status;
    private array $data;
    private ?string $message;

    private function __construct(
        string $status,
        array $data = [],
        ?string $message = null,
        int $statusCode = 200
    ) {
        $this->status     = $status;
        $this->data       = $data;
        $this->message    = $message;
        $this->statusCode = $statusCode;
    }

    /**
     * Crée une réponse de succès
     *
     * @param array $data
     * @param string|null $message
     * @return self
     */
    public static function success(array $data = [], ?string $message = null): self
    {
        return array('success', $data, $message);
    }

    /**
     * Crée une réponse d'erreur
     *
     * @param string $message
     * @param int $statusCode
     * @param array $data
     * @return self
     */
    public static function error(
        string $message,
        int $statusCode = 400,
        array $data = []
    ) {
        return array('error', $data, $message, $statusCode);
    }

    /**
     * Envoie la réponse
     */
    public function send(): void
    {
        http_response_code($this->statusCode);
        header('Content-Type: application/json');

        echo json_encode([
            'status'  => $this->status,
            'data'    => $this->data,
            'message' => $this->message,
        ]);
    }

    /**
     * Convertit la réponse en tableau
     *
     * @return array
     */
    public function toArray(): array
    {
        return [
            'status'  => $this->status,
            'data'    => $this->data,
            'message' => $this->message,
            'code'    => $this->statusCode,
        ];
    }
}
