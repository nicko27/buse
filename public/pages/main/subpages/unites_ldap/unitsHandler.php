<?php
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Ldap\LdapManager;
use Commun\Utils\TphUtils;
require_once dirname(__DIR__, 3) . "/commun/init.php";

$config     = Config::getInstance();
$sqlManager = SqlManager::getInitializedInstance();

$dateOperation = date("Y-m-d H:i:s");
$result        = getChildrenUnits($dateOperation, $config->get('LDAP_BASE_DEPARTMENTUID'), $config->get('LDAP_BASE_DEPARTMENTCU'));

$sql  = "select cu from unites_ldap where isCie=1";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$unites_tbl = $stmt->fetchAll((PDO::FETCH_ASSOC));
foreach ($unites_tbl as $unite) {
    $cu            = $unite["cu"];
    $data          = [];
    $data["id"]    = null;
    $data["cu"]    = $unite["cu"];
    $data["ordre"] = 100;
    $data["color"] = sprintf('#%06X', mt_rand(0, 0xFFFFFF));
    $id            = $sqlManager->insertIfAbsent("compagnies", $data, ["cu" => $cu]);
}
$sqlManager->delete("unites_ldap", "dateOperation!=:dateOperation", ["dateOperation" => $dateOperation]);

echo json_encode(["error" => 0]);

function getChildrenUnits($dateOperation, $schema, $parentCu, $cuCie = 0, $cuCob = 0, $cobCity = "")
{
    global $sqlManager, $ldapManager, $config;
    $ciesLdapName         = explode("|", $config->get("LDAP_UNIT_CIE"));
    $cobLdapName          = explode("|", $config->get("LDAP_UNIT_COB"));
    $ldapManager          = LdapManager::getInstance();
    static $ciesListNames = null;
    static $cobsListNames = null;
    static $alreadyDone   = [];
    $search               = sprintf("parentDepartmentUID=%s", $schema);
    $attributes           = ["cn", "l", "businessCategory", "departmentUID", "parentDepartmentUID", "codeServiceRio", "ou", "telephoneNumber", "postalAddress", "codeUnite", "rank", "postalCode", "mail"];
    $resultTbl            = $ldapManager->searchServices($search, $attributes, 50);
    $parentDepartmentUID  = 0;
    $city                 = "";
    foreach ($resultTbl as $tbl) {
        $data            = [];
        $data["tph"]     = "";
        $data["address"] = "";
        foreach ($tbl as $key => $value) {
            switch ($key) {
                case "l":
                    $city = $value;
                    break;
                case "codeunite":
                    $data["cu"] = $value;
                    $cu         = $value;
                    break;
                case "codeservicerio":
                    $data["codeServiceRio"] = $value;
                    break;
                case "telephonenumber":
                    if ($value === null) {
                        $data["tph"] = "";
                    } else {
                        $data["tph"] = TphUtils::formatPhoneWithZeros($value);
                    }
                    break;
                case "ou":
                    $data["name"]    = $value;
                    $data["newName"] = $value;
                    break;
                case "postaladdress":
                    if ($value === null) {
                        $value = "";
                    }

                    $data["address"] = $value;
                    break;
                case "departmentuid":
                    $parentDepartmentUID = $value;
                    break;
                case "rank":
                    $data["cuCie"] = $value;
                    break;
                case "businesscategory":
                    $abrege = $value;
                    break;
                case "cn":
                    $data["label"] = $value;
                case "postalcode":
                    $data['code_postal'] = $value;
                case "mail":
                    $data['mail'] = $value;
            }
        }
        $data["isCie"] = 0;
        if (in_array($abrege, $ciesLdapName)) {
            $cuCie         = $cu;
            $data["isCie"] = 1;
        }
        if (in_array($abrege, $cobLdapName)) {
            $cuCob   = $cu;
            $cobCity = $city;
        }
        $data['cuCie']    = $cuCie;
        $data["isCob"]    = ($cuCob > 0) ? 1 : 0;
        $data["cuCob"]    = $cuCob;
        $data["id"]       = null;
        $data["parentCu"] = $parentCu;
        if (($cu != $cuCob) && ($cuCob > 0)) {
            if ($city == $cobCity) {
                $data["mergedWithCu"] = 0;
            }

        }
        $data["invisible"] = 0;
        error_log(json_encode($data));
        $result = $sqlManager->insertIfAbsent("unites_ldap", $data, ["cu" => $cu]);
        if ($result['id']) {
            unset($data['id']);
            unset($data['invisible']);
            unset($data['cuCob']);
            $sqlManager->update("unites_ldap", $data, "cu = :cu", ["cu" => $cu]);
        }

        if (! in_array($parentDepartmentUID, $alreadyDone)) {
            $alreadyDone[] = $parentDepartmentUID;
            $size          = getChildrenUnits($dateOperation, $parentDepartmentUID, $cu, $cuCie, $cuCob, $cobCity);
        }

    }
    return sizeof($resultTbl);
}
