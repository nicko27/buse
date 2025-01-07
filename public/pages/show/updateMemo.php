<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

$datetime           = DateTime::createFromFormat('d.m.Y', $_POST['start-date']);
$formattedStartDate = $datetime->format('Y-m-d');
$datetime           = DateTime::createFromFormat('d.m.Y', $_POST['end-date']);
$formattedEndDate   = $datetime->format('Y-m-d');
$alarm              = ($_POST['permanent'] == 0) ? $_POST['alarm'] : 0;
$data               = [
    "startTime"      => sprintf("%s:%s", $_POST['start-hour'], $_POST['start-minute']),
    "endTime"        => sprintf("%s:%s", $_POST['end-hour'], $_POST['end-minute']),
    "startDate"      => $formattedStartDate,
    "endDate"        => $formattedEndDate,
    "memo"           => $_POST["memo"],
    "invisible"      => 0,
    "alarm"          => $alarm,
    "alarmTriggered" => 0,
    "permanent"      => $_POST['permanent'],
];
$returnValue = updateSql("memos", $data, "id=" . $_POST["id"]);
echo json_encode($returnValue);
