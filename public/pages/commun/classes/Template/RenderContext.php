<?php
namespace Commun\Template;

/**
 * Contextes de rendu pour TwigManager
 *
 * Définit les différents types de rendu possibles :
 * - FULL_PAGE : Page complète avec layout, zones, templates multiples
 * - MODAL : Fragment modal sans layout pour les popups/modales
 * - COMPONENT : Composant isolé réutilisable
 *
 * @package Commun\Template
 * @author Application Framework
 * @version 1.0
 */
enum RenderContext: string {
    /**
     * Rendu de page complète avec layout
     * Inclut : header, footer, navigation, zones de templates
     */
    case FULL_PAGE = 'full_page';

    /**
     * Rendu de fragment modal
     * Inclut : contenu uniquement, sans layout
     */
    case MODAL = 'modal';

    /**
     * Rendu de composant isolé
     * Inclut : élément spécifique réutilisable
     */
    case COMPONENT = 'component';

    /**
     * Retourne la description du contexte
     *
     * @return string Description du contexte
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::FULL_PAGE => 'Page complète avec layout et zones',
            self::MODAL => 'Fragment modal sans layout',
            self::COMPONENT => 'Composant isolé réutilisable'
        };
    }

    /**
     * Indique si ce contexte nécessite un layout complet
     *
     * @return bool True si layout requis
     */
    public function requiresLayout(): bool
    {
        return match ($this) {
            self::FULL_PAGE => true,
            self::MODAL => false,
            self::COMPONENT => false
        };
    }

    /**
     * Indique si ce contexte nécessite les variables de navigation
     *
     * @return bool True si navigation requise
     */
    public function requiresNavigation(): bool
    {
        return match ($this) {
            self::FULL_PAGE => true,
            self::MODAL => false,
            self::COMPONENT => false
        };
    }

    /**
     * Retourne les variables globales nécessaires pour ce contexte
     *
     * @return array<string> Liste des noms de variables globales
     */
    public function getRequiredGlobals(): array
    {
        return match ($this) {
            self::FULL_PAGE => [
                'app',
                'request',
                'config',
                'user',
                'navigation',
                'current_route',
                'page_data',
                'csrf_token',
                'debug_info',
            ],
            self::MODAL => [
                'app',
                'request',
                'user',
                'csrf_token',
            ],
            self::COMPONENT => [
                'app',
                'user',
            ]
        };
    }
}
