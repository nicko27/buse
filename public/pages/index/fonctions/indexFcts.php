<?php

require_once dirname(__DIR__, 3) . "/pages/commun/init.php";

use Commun\Config\Config;
use Commun\Logger\Logger;

$logger = Logger::getInstance()->getLogger();

function initVars($get = [])
{
    $config                           = Config::getInstance();
    $vars                             = [];
    $vars['CSRF_TOKEN']               = $_SESSION['CSRF_TOKEN'];
    $vars['ASSETS_DIR']               = $config->get('ASSETS_DIR');
    $vars['SHORTCUT_ICON']            = $config->get('SHORTCUT_ICON');
    $vars['WEB_ASSETS']               = $config->get('WEB_ASSETS');
    $vars['PAGE_SHOW_PERMANENCES']    = $config->get('PAGE_SHOW_PERMANENCES');
    $vars['PAGE_SHOW_TIMELINE']       = $config->get('PAGE_SHOW_TIMELINE');
    $vars['PAGE_ACCUEIL']             = $config->get('PAGE_ACCUEIL');
    $vars['PAGE_INDEX']               = $config->get('PAGE_INDEX');
    $vars['PAGE_MAJ']                 = $config->get('PAGE_MAJ');
    $vars['INDEX']                    = $config->get('INDEX');
    $vars['page']                     = $config->get('PAGE_INDEX');
    $vars['VIEWS_DIR']                = $config->get('VIEWS_DIR');
    $vars['WEB_PAGES']                = $config->get('WEB_PAGES');
    $vars['SITE']                     = $config->get('SITE');
    $vars['SUBTITLE']                 = $config->get('SUBTITLE');
    $vars['SITE_FIRST_MAJ']           = ucfirst(strtolower($config->get('SITE')));
    $vars['SITE_LONG_NAME']           = $config->get('SITE_LONG_NAME');
    $vars['debug']                    = isset($_GET['debug']) ? $_GET['debug'] : 0;
    $vars['SUBPAGE_IMPORT']           = $config->get('SUBPAGE_IMPORT');
    $vars['SUBPAGE_UPDATE']           = $config->get('SUBPAGE_UPDATE');
    $vars['SUBPAGE_SITES']            = $config->get('SUBPAGE_SITES');
    $vars['SUBPAGE_CIES']             = $config->get('SUBPAGE_CIES');
    $vars['SUBPAGE_SERVICES']         = $config->get('SUBPAGE_SERVICES');
    $vars['SUBPAGE_UNITES']           = $config->get('SUBPAGE_UNITES');
    $vars['SUBPAGE_UNITES_MANUELLES'] = $config->get('SUBPAGE_UNITES_MANUELLES');
    $vars['SUBPAGE_UNITES_LDAP']      = $config->get('SUBPAGE_UNITES_LDAP');
    $vars['SUBPAGE_PREPARE_SYNTHESE'] = $config->get('SUBPAGE_PREPARE_SYNTHESE');
    $vars['SUBPAGE_CATEGORIES']       = $config->get('SUBPAGE_CATEGORIES');
    $vars['SUBPAGE_CITIES']           = $config->get('SUBPAGE_CITIES');
    $vars['SUBPAGE_MAIRIES']          = $config->get('SUBPAGE_MAIRIES');
    $vars['SUBPAGE_MAIL_SYNTHESE']    = $config->get('SUBPAGE_MAIL_SYNTHESE');
    $vars['WEB_PUBLIC']               = $config->get('WEB_PUBLIC');
    $vars['WEB_SERVER']               = $config->get('WEB_SERVER');
    $vars['PAGES_DIR']                = $config->get('PAGES_DIR');
    $vars['SUBPAGE_CONFIGURATION']    = $config->get('SUBPAGE_CONFIGURATION');

    return $vars;
}

function getPagesVars($page, $vars, $get)
{
    $config            = Config::getInstance();
    $vars['page']      = $page;
    $vars['page_root'] = $config->get('PAGES_LIST')[$vars['page']];

    $pagePath = $config->get('PAGES_DIR') . "/" . $config->get('PAGES_LIST')[$page] . ".php";
    if (! file_exists($pagePath)) {
        throw new \Exception("Page file not found: " . $pagePath);
    }
    require_once $pagePath;

    $subpage           = (isset($_GET['subpage'])) ? $_GET['subpage'] : 0;
    $vars['PAGE_NAME'] = $config->get('PAGES_LIST')[$vars['page']];
    if ($page == $config->get('PAGE_INDEX')) {
        $views                = sprintf("%s/%s/main.twig", $config->get('MAIN_SUBPAGES'), $config->get('SUBPAGES_MAIN_LIST')[$subpage]);
        $vars['SUBPAGE']      = $views;
        $vars['SUBPAGE_NAME'] = $config->get('SUBPAGES_MAIN_LIST')[$subpage];
        $vars['SUBJS']        = sprintf("%s/js/%s/%s/main.js", $config->get('ASSETS_DIR'), $config->get('MAIN_SUBPAGES'), $config->get('SUBPAGES_MAIN_LIST')[$subpage]);
    }
    return $vars;
}
