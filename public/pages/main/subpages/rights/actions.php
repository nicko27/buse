<?php
$users = [];
$users[] = [
    "id" => 123456, 
    "u_ou_g" => 0, 
    "name" => "FLEURY Antoine ADJ", 
    "firstName" => "Antoine", 
    "lastName" => "FLEURY"
];
$users[] = [
    "id" => 12027, 
    "u_ou_g" => 1, 
    "name" => "SOLC BDRIJ GGD27", 
    "firstName" => "", 
    "lastName" => "SOLC BDRIJ GGD27"
];
echo json_encode(["users" => $users]);