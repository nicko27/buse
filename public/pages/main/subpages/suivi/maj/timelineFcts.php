<?php
include "../../../../commun/init.php";
use Commun\Database\SqlManager;
use Commun\Ldap\LdapManager;
use Commun\Utils\StringUtils;
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
    $sql  = "SELECT isCob FROM unites_ldap WHERE cu = :cu";
    $stmt = $sqlManager->prepare($sql);
    $stmt->bindParam(":cu", $cu, PDO::PARAM_STR);
    $stmt->execute();
    $resultat = $stmt->fetch();

    if ($resultat["isCob"] === 0) {
        return $cu;
    } else {
        $sqlCu  = "SELECT mergedWithCu from unites_ldap where cu=:cu";
        $stmtCu = $sqlManager->prepare($sqlCu);
        $stmtCu->bindParam(':cu', $cu, PDO::PARAM_STR);
        $stmtCu->execute();
        $resultatCu = $stmtCu->fetch();
        $brigadeCu  = $resultatCu['mergedWithCu'];

        // Utilise le PAM si nécessaire
        if ($pam == 1 && ($brigadeCu == 0 || ($brigadeCu == intval($cu)))) {
            $pamCu = getPamCu($tph);
            if ($pamCu != 0) {
                $cu        = $pamCu;
                $brigadeCu = 1;
                return $cu;
            }
        }
        $cu = ($brigadeCu == $cu) ? 0 : $brigadeCu;
        return $cu;
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
 * Récupère le code unité basé sur l'étiquette complète de la brigade.
 *
 * @param string $input Nom de la brigade.
 * @return string Code unité correspondant.
 */
function getBrigadeFromName($input)
{
    global $sqlManager;
    $sql  = "SELECT cu FROM unites_ldap UPPER(name) LIKE UPPER(:name)";
    $stmt = $sqlManager->prepare($sql);
    $stmt->bindValue(':name', $input, PDO::PARAM_STR);
    $stmt->execute();
    $resultat = $stmt->fetch();

    return $resultat ? $resultat['cu'] : 0;
}

/**
 * Traite l'étiquette de la brigade pour la mise en forme SQL.
 *
 * @param string $input Nom de la brigade.
 * @param bool $fullLabel Indicateur pour l'utilisation de l'étiquette complète.
 * @return string Étiquette traitée.
 */
function processBrigadeLabel($input, $fullLabel = false)
{
    global $sqlManager;
    $input = StringUtils::stripAccents($input);
    $input = str_replace(["Brigade de proximite de", "Brigade de proximite d'"], "", $input);
    $input = trim($input);
    $input = str_replace("'", "-", $input);
    $input = strtoupper($input);

    return $fullLabel ? "%{$input}%" : "{$input}";
}
