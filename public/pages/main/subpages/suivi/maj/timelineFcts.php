<?php
use Commun\Database\SqlManager;
use Commun\Ldap\LdapManager;
use Commun\Utils\StringUtils;
require_once dirname(__DIR__, 4) . "/commun/init.php";

$sqlManager  = SqlManager::getInstance();
$ldapManager = LdapManager::getInstance();
/**
 * Récupère le code unité correct en fonction de plusieurs critères.
 *
 * @param string $cu Code unité initial.
 * @param string $brigade Nom de la brigade.
 * @param string $tph Numéro de téléphone.
 * @param int $full Indicateur pour l'utilisation de l'étiquette complète de la brigade.
 * @param int $pam Indicateur pour l'utilisation du PAM.
 * @return string Code unité correct.
 */
function getCorrectCu($cu, $brigade, $tph, $full = 0, $pam = 1)
{
    global $sqlManager;
    // Vérifie le type d'unité
    $sql  = "SELECT isCob,mergedWithCu,cuCob FROM unites_ldap WHERE cu = :cu";
    $stmt = $sqlManager->prepare($sql);
    $stmt->bindParam(":cu", $cu, PDO::PARAM_STR);
    $stmt->execute();
    $resultat = $stmt->fetch();
    if ($resultat["isCob"] === 1) {
        if (isCobName($brigade)) {
            return $resultat["mergedWithCu"];
        }
        $brigade  = processBrigadeLabel($brigade, $full);
        $resultat = getBrigadeFromName($brigade, $cu);
        if ($resultat === false) {
            if (isSaintName($brigade)) {
                $stBrigadeName = StBrigadeFromName($brigade);
                $resultat      = getBrigadeFromName($stBrigadeName, $cu);
            }
        }
        return $resultat ? $resultat["cu"] : $cu;
    } else {
        return $cu;
    }
}

function stBrigadeFromName($brigade)
{
    $pattern  = "/saint/i";
    $replace  = "st";
    $resultat = preg_replace($pattern, $replace, $brigade);
    return $resultat;
}

function getBrigadeFromName($brigade, $cu)
{
    global $sqlManager;
    $sql  = "SELECT cu FROM unites_ldap WHERE upper(name) LIKE :brigade and cuCob = :cu and cu!= :cu";
    $stmt = $sqlManager->prepare($sql);
    $stmt->bindParam(":brigade", $brigade, PDO::PARAM_STR);
    $stmt->bindParam(":cu", $cu, PDO::PARAM_STR);
    $stmt->execute();
    return $stmt->fetch();
}

function isSaintName($brigade)
{
    $pattern = '/saint/i';
    if (preg_match($pattern, $brigade)) {
        return true;
    } else {
        return false;
    }
}

function isCobName($brigade)
{
    $pattern = '/communauté\s*de\s*brigades?/i';
    if (preg_match($pattern, $brigade)) {
        return true;
    } else {
        return false;
    }
}

/**
 * Récupère le code unité basé sur le numéro de téléphone PAM.
 *
 * @param string $tph Numéro de téléphone.
 * @return string Code unité correspondant.
 */
function getPamCu($tph)
{
    global $sqlManager;
    $sql  = "SELECT cu FROM tph_pam WHERE tph = :tph LIMIT 1";
    $stmt = $sqlManager->prepare($sql);
    $stmt->bindValue(":tph", $tph, PDO::PARAM_STR);
    $stmt->execute();
    $resultat = $stmt->fetch();

    return $resultat ? $resultat['cu'] : 0;
}

/**
 * Traite l'étiquette de la brigade pour la mise en forme SQL.
 *
 * @param string $input Nom de la brigade.
 * @return string Étiquette traitée.
 */
function processBrigadeLabel($input)
{
    global $sqlManager;
    $input = StringUtils::stripAccents($input);
    $input = str_replace(["Brigade de proximite du", "Brigade de proximite de", "Brigade de proximite d'"], "", $input);
    $input = trim($input);
    $input = str_replace("'", "-", $input);
    $input = strtoupper($input);

    return "%{$input}";
}
