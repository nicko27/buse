<?php
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Ldap\LdapManager;
require_once dirname(__DIR__, 3) . "/commun/init.php";
// Récupérer l'instance de Config
$config                   = Config::getInstance();
$sqlManager               = SqlManager::getInstance();
$queryName                = sprintf("cn=*%s*", $_GET['query']);
$queryNigend              = sprintf("employeenumber=*%s*", $_GET['query']);
$queryCu                  = sprintf("codeunite=*%s*", $_GET['query']);
$queryUnitsName           = sprintf("ou=*%s*", $_GET['query']);
$ldapManager              = LdapManager::getInstance();
$persons                  = $ldapManager->searchPersons($queryName, ['*'], 10);
$servicesAttributes       = ['codeunite', 'ou'];
$personsAttributes        = ["employeenumber", "cn", "displayName"];
$personsName              = $ldapManager->searchPersons($queryName, $personsAttributes, 10);
$personsCu                = $ldapManager->searchPersons($queryCu, $personsAttributes, 10);
$servicesCu               = $ldapManager->searchServices($queryCu, $servicesAttributes, 20);
$servicesName             = $ldapManager->searchServices($queryUnitsName, $servicesAttributes, 20);
$tblPersonsSql            = [];
$tblServicesSql           = [];
$users                    = [];
[$users, $tblPersonsSql]  = getPersons($personsName, $users, $tblPersonsSql);
[$users, $tblPersonsSql]  = getPersons($personsNigend, $users, $tblPersonsSql);
[$users, $tblServicesSql] = getServices($servicesCu, $users, $tblPersonsSql);
[$users, $tblServicesSql] = getServices($servicesName, $users, $tblPersonsSql);
echo json_encode(["users" => $users]);

function getServices($servicesList, $users, $tblPersonsSql)
{
    global $sqlManager;
    foreach ($servicesList as $service) {
        $id   = $service['codeunite'];
        $sql  = "select id from rights where id=:id and u_ou_g=1";
        $stmt = $sqlManager->prepare($sql);
        $stmt->execute([':id' => $id]);
        $results = $stmt->fetchAll();
        if (!in_array($id, $tblPersonsSql)) {
            if (sizeof($results) == 0) {
                $data                = [];
                $data['id']          = $id;
                $data['name']        = $service['ou'];
                $data['u_ou_g']      = 1;
                $data['displayname'] = $service['ou'];
                $users[]             = $data;
            }
            $tblServicesSql[] = $id;
        }
    }
    return [$users, $tblServicesSql];
}

function getPersons($personsList, $users, $tblPersonsSql)
{
    global $sqlManager;
    foreach ($personsList as $person) {
        $id   = $person['employeenumber'];
        $sql  = "select id from rights where id=:id and u_ou_g=0";
        $stmt = $sqlManager->prepare($sql);
        $stmt->execute([':id' => $id]);
        $results = $stmt->fetchAll();
        if (!in_array($id, $tblPersonsSql)) {
            if (sizeof($results) == 0) {
                $data                = [];
                $data['id']          = $id;
                $data['name']        = sprintf("%s (%s)", $person['cn'], $person['employeenumber']);
                $data['u_ou_g']      = 0;
                $data['displayName'] = $person['displayname'];
                $users[]             = $data;
            }
            $tblPersonsSql[] = $id;
        }
    }
    return [$users, $tblPersonsSql];
}
