<?php

if (!$rightsManager->isAdmin()) {
    exit(1);
}
$sql  = "SELECT * FROM rights";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
#$vars['rights_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
$results_tbl=$stmt->fetchAll(PDO::FETCH_ASSOC);
$rights_tbl=[];
foreach($results_tbl as $right){
	if($right["id"] ==  $rightsManager->getUserId()){
		$right["read_only_super_admin"]="readonly";
	}
	if(($right["super_admin"]==1) && ($rightsManager->isAdmin())){
		$right["readonly_timeline"]="readonly";
		$right["readonly_permanences"]="readonly";
		$right["readonly_import_data"]="readonly";
		$right["readonly_admin"]="readonly";
		$right["readonly_super_admin"]="readonly";
	}
	$right["readonly_name"]="readonly";
	$rights_tbl[]=$right;
}
$vars['rights_tbl']=$rights_tbl;