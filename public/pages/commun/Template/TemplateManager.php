<?php
namespace Commun\Template;

use Commun\Config\Config;
use Commun\Database\SqlManager;

/**
 * TemplateManager : prépare toutes les variables Twig et fait le rendu.
 */
class TemplateManager
{
    private Config $config;
    private SqlManager $db;

    public function __construct(Config $config, SqlManager $db)
    {
        $this->config = $config;
        $this->db     = $db;
    }

    /**
     * Prépare toutes les variables à injecter dans Twig.
     * @param array $resolved Résultat de l’ordonnanceur
     * @param array $globals  Variables globales (version, csrf, etc.)
     * @param array $get      $_GET
     * @return array
     */
    public function buildTwigVars(array $resolved, array $globals, array $get): array
    {
        $vars = $globals;

        // Variables de config
        foreach ([
            'ASSETS_DIR', 'SHORTCUT_ICON', 'WEB_ASSETS', 'VIEWS', 'WEB_PAGES', 'SITE', 'SUBTITLE',
            'SITE_LONG_NAME', 'WEB_PUBLIC', 'WEB_SERVER', 'PAGES_DIR',
        ] as $k) {
            $vars[$k] = $this->config->get($k);
        }
        $vars['SITE_FIRST_MAJ'] = ucfirst(strtolower($vars['SITE']));
        $vars['debug']          = $get['debug'] ?? 0;

        // Page principale
        $vars['PAGE_LABEL']    = $resolved['page']['label'];
        $vars['PAGE_SLUG']     = $resolved['page']['slug'];
        $vars['PAGE_TEMPLATE'] = $resolved['page']['template'];
        $vars['PAGE_PHP']      = $resolved['page']['php_file'];
        $vars['PAGE_ID']       = $resolved['page']['id'];

        // Sous-page éventuelle
        if ($resolved['subpage']) {
            $vars['SUBPAGE_LABEL']    = $resolved['subpage']['label'];
            $vars['SUBPAGE_SLUG']     = $resolved['subpage']['slug'];
            $vars['SUBPAGE_TEMPLATE'] = $resolved['subpage']['template'];
            $vars['SUBPAGE_PHP']      = $resolved['subpage']['php_file'];
            $vars['SUBPAGE_ID']       = $resolved['subpage']['id'];
        }

        // Menu dynamique
        $menuStmt = $this->db->prepare("SELECT * FROM pages WHERE parent_id IS NULL AND actif = 1 ORDER BY ordre ASC");
        $menuStmt->execute();
        $vars['MENU_PAGES'] = $menuStmt->fetchAll();
        $submenuStmt        = $this->db->prepare("SELECT * FROM pages WHERE parent_id = :pid AND actif = 1 ORDER BY ordre ASC");
        $submenuStmt->execute(['pid' => $resolved['page']['id']]);
        $vars['MENU_SUBPAGES'] = $submenuStmt->fetchAll();

        return $vars;
    }

    /**
     * Détermine le template à utiliser pour Twig.
     */
    public function getTemplate(array $resolved): string
    {
        return $resolved['subpage']['template'] ?? $resolved['page']['template'];
    }

    /**
     * Fait le rendu Twig et l’affiche.
     */
    public function render(\Twig\Environment $twig, array $resolved, array $vars): void
    {
        $template = $this->getTemplate($resolved);
        echo $twig->render($template, $vars);
    }
}
