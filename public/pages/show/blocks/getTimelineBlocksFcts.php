<?php

/**
 * Obtenir l'heure de la première case en fonction de la position actuelle, de l'intervalle, d'une heure de débogage optionnelle et d'une date de débogage optionnelle.
 *
 * @param int $case_pos_now Position actuelle de la case (1 pour la première case, etc.).
 * @param int $interval Intervalle en minutes entre les cases.
 * @param string|null $debug_date Date de débogage spécifiée au format 'YYYY-MM-DD', "0" si non spécifiée.
 * @param string|null $debug_hour Heure de débogage spécifiée au format 'HH:MM', null si non spécifiée.
 * @return DateTime Heure de la première case.
 */
function getFirstCaseTime(int $case_pos_now, int $interval, ?string $debug_date = null, ?string $debug_hour = null): DateTime
{
    $current_time = new DateTime();

    // Utiliser la date de débogage si spécifiée et différente de "0"
    if ($debug_date !== null && $debug_date !== "0") {
        $current_time->setDate((int) substr($debug_date, 0, 4), (int) substr($debug_date, 5, 2), (int) substr($debug_date, 8, 2));
    }

    // Utiliser l'heure de débogage si spécifiée
    if ($debug_hour !== null && preg_match('/^\d{2}:\d{2}$/', $debug_hour)) {
        list($hour, $minute) = explode(':', $debug_hour);
        $current_time->setTime((int) $hour, (int) $minute, 0);
    } else {
        $current_minute = (int) $current_time->format('i');
        $rounded_minute = floor($current_minute / $interval) * $interval;
        $current_time->setTime((int) $current_time->format('H'), $rounded_minute, 0);
    }

    $first_case_minute_offset = ($case_pos_now - 1) * $interval;
    $first_case_time          = clone $current_time;
    $first_case_time->modify("-{$first_case_minute_offset} minutes");

    return $first_case_time;
}

/**
 * Obtenir l'heure de la dernière case en fonction de l'heure de la première case et du nombre total de cases.
 *
 * @param DateTime $first_case_time Heure de la première case.
 * @param int $total_cases Nombre total de cases.
 * @param int $interval Intervalle en minutes entre les cases.
 * @return DateTime Heure de la dernière case.
 */
function getLastCaseTime(DateTime $first_case_time, int $total_cases, int $interval): DateTime
{
    $total_minutes  = $total_cases * $interval;
    $last_case_time = clone $first_case_time;
    $last_case_time->modify("+{$total_minutes} minutes");

    return $last_case_time;
}

function handleBlocksByCu(array $resultList, int $nbQuartHeure, int $minimumBlockConcat, int $nbLinesTimeline): array
{
    if (sizeof($resultList) > 0) {
        $matrix     = array_fill(1, $nbQuartHeure, []);
        $blocksList = [];
        $idBlock    = 0;

        foreach ($resultList as $resultat) {
            for ($i = $resultat["start_column"]; $i <= $resultat["end_column"]; $i++) {
                $matrix[$i][] = $resultat["suId"];
            }

            $idBlock++;

            $block                      = $resultat;
            $block["users"]             = json_decode($resultat["users"], true);
            $block["idBlock"]           = $idBlock;
            $block["idList"]            = [$resultat['suId']];
            $block["rubis"]             = isset($resultat['rubis']) ? $resultat['rubis'] : "";
            $block["text"]              = $resultat['tph'];
            $block["outdated"]          = 0;
            $block['merged']            = 0;
            $block['start_line']        = 0;
            $block['end_line']          = 0;
            $block['real_start_column'] = $block['start_column'] + 0.1;
            $block['real_end_column']   = $block['end_column'] - 0.1;
            $blocksList[]               = $block;
        }

        $timelineOk  = 0;
        $returnValue = [];

        $blocksList  = blocksConcat($blocksList, $minimumBlockConcat);
        $returnValue = tryArrangeBlocks($blocksList, $nbQuartHeure, $nbLinesTimeline);
        $timelineOk  = $returnValue['allPlaced'];

        if ($timelineOk == 1) {
            return $returnValue['blocksList'];
        } else {
            return [];
        }
    } else {
        return [];
    }
}

function orderBlocksByColumns($blocksList)
{
    // Trier les blocs par leur start_column (ordre chronologique)
    usort($blocksList, function ($a, $b) {
        return $a['start_column'] <=> $b['start_column'];
    });
    return $blocksList;
}

/**
 * Obtenir la liste des blocs ayant $column comme start_column.
 *
 * @param array $blocksList Liste des blocs générés par handleBlocksByCu().
 * @param int $column Colonne de départ à rechercher.
 * @return array Liste des blocs avec start_column égal à $column.
 */
function getBiggestBlockByStartColumn(array $blocksList, int $column)
{
    // Filtrer les blocs ayant start_column égal à $column
    $filteredBlocks = array_filter($blocksList, function ($block) use ($column) {
        return $block['start_column'] == $column;
    });

    // Si plusieurs blocs ont le même start_column, on prend celui avec le plus grand end_column - start_column
    if (count($filteredBlocks) > 0) {
        return array_reduce($filteredBlocks, function ($carry, $item) {
            $currentRange = $item['end_column'] - $item['start_column'];
            if ($carry === null || $currentRange > ($carry['end_column'] - $carry['start_column'])) {
                return $item;
            }
            return $carry;
        });
    }

    // Retourner null si aucun bloc n'est trouvé
    return null;
}

function cleanBlocksListFromAlreadyPlaced(array $blocksList): array
{
    $start_line     = 0;
    $filteredBlocks = array_filter($blocksList, function ($block) use ($start_line) {
        return $block['start_line'] == $start_line;
    });

    // Réindexer le tableau pour éviter les indices décalés
    return array_values($filteredBlocks);
}

function cleanBlocksListFromWrongTouch(array $blocksList): array
{
    if (sizeof($blocksList) > 0) {
        $start_column   = $blocksList[0]['end_column'];
        $filteredBlocks = array_filter($blocksList, function ($block) use ($start_column) {
            return $block['start_column'] != $start_column;
        });

        // Réindexer le tableau pour éviter les indices décalés
        return array_values($filteredBlocks);
    } else {
        return [];
    }
}

function getBlocksListOnColumns(array $blocksList, int $start_column, int $end_column): array
{
    $filteredBlocksList = [];
    foreach ($blocksList as $bl) {
        $accepted = false;
        if ($bl['real_start_column'] > $start_column) {
            if ($bl['real_start_column'] < $end_column) {
                $accepted = true;
            }
        }
        if ($bl['start_column'] == $start_column) {
            if ($bl['end_column'] == $end_column) {
                $accepted = true;
            }
        }

        if ($accepted) {
            $filteredBlocksList[] = $bl;
        }
    }
    return $filteredBlocksList;
}

/**
 * Essayer d'arranger les blocs.
 *
 * @param array $blocksList Liste des blocs triés par priorité.
 * @return int|null ID du bloc qui pose problème ou null si tous les blocs ont été positionnés correctement.
 */
function tryArrangeBlocks(array $blocksList, int $nbQuartHeure, int $nbLinesTimeline): ?array
{
    $allPlaced               = false;
    $timeline                = initializeTimeline($nbQuartHeure, $nbLinesTimeline);
    $alreadyPlacedBlocksList = [];
    $pbBlocksList            = [];
    for ($column = 1; $column <= $nbQuartHeure; $column++) {
        $bl = getBiggestBlockByStartColumn($blocksList, $column);
        if ($bl != null) {
            $blocksToPlaceList = getBlocksListOnColumns($blocksList, $bl['start_column'], $bl['end_column']);
            $blocksToPlaceList = cleanBlocksListFromAlreadyPlaced($blocksToPlaceList);
            $blocksToPlaceList = orderBlocksByColumns($blocksToPlaceList);
            if (sizeof($blocksToPlaceList) > 0) {
                $height   = floor($nbLinesTimeline / count($blocksToPlaceList));
                $canPlace = false;
                while (($canPlace == false) && ($height >= 1)) {
                    $returnValue = tryPlaceBlocksFirstPass($blocksToPlaceList, $height, $timeline, $blocksList, $nbLinesTimeline);
                    $canPlace    = $returnValue['canPlace'];
                    if ($canPlace == false) {
                        $height--;
                    }
                }
                if ($canPlace == true) {
                    $allPlaced               = true;
                    $blocksList              = updateBlocksList($blocksList, $returnValue['blocksList']);
                    $alreadyPlacedBlocksList = addBlockIfAbsent($alreadyPlacedBlocksList, $blocksToPlaceList);
                    $timeline                = $returnValue['timeline'];
                } else {
                    $allPlaced    = false;
                    $pbBlocksList = addBlockIfAbsent($pbBlocksList, $blocksList);
                }
            }
        }
    }
    return array("allPlaced" => $allPlaced, "blocksList" => $blocksList);
}

function updateBlocksList($blocksList, $newBlocksList)
{
    foreach ($newBlocksList as $nBL) {
        foreach ($blocksList as &$block) {
            if ($nBL['idBlock'] == $block['idBlock']) {
                $block = $nBL;
            }
        }
    }
    return $blocksList;
}

function addBlockIfAbsent($blocksList, $blocksToAddList)
{
    foreach ($blocksToAddList as $block) {
        $exists = false;
        foreach ($blocksList as $existingBlock) {
            if ($existingBlock['idBlock'] === $block['idBlock']) {
                $exists = true;
                break;
            }
        }

        if (!$exists) {
            $blocksList[] = $block;
        }
    }
    return $blocksList;
}

function getInfoFromBlock($blocksList, $idBlock, $info)
{
    foreach ($blocksList as $bl) {
        if ($bl['idBlock'] == $idBlock) {
            return $bl[$info];
        }
    }
    return false;

}

function tryPlaceBlocksFirstPass(array $blocksList, $block_height, $timeline, $totalBlocksList, $nbLinesTimeline)
{

    foreach ($blocksList as &$block) {
        $canPlace = false;
        if (($block['start_line'] == 0) && ($block['end_line'] == 0)) {
            $start_line = 1;
            $line       = $start_line;
            // Vérification si le bloc peut être placé sans chevauchement
            while ((($line + $block_height - 1) <= $nbLinesTimeline) && $canPlace == false) {
                $allOk = true;
                for ($line = $start_line; $line <= $start_line + $block_height - 1; $line++) {
                    for ($col = $block['start_column']; $col <= $block['end_column']; $col++) {
                        $idBlock = $timeline[$line][$col]['content'];
                        if ($col == $block['start_column']) {
                            if ($idBlock > 0) {
                                $end_column   = getInfoFromBlock($totalBlocksList, $idBlock, "end_column");
                                $start_column = getInfoFromBlock($totalBlocksList, $idBlock, "start_column");
                                if ($end_column != false) {
                                    if ($end_column != $block['start_column']) {
                                        $allOk = false;
                                        break 2;
                                    }
                                    if (($end_column == $block['end_column']) && ($start_column == $block['start_column'])) {
                                        $allOk = false;
                                        break 2;
                                    }
                                }
                                if (($start_column == $block['start_column']) && ($timeline[$line][$col]['content'] != 0)) {
                                    $allOk = false;
                                    break 2;
                                }

                            }
                            if ($timeline[$line][$col]['notBlockBorder'] != 0) {
                                $allOk = false;
                                break 2;
                            }

                        } else {
                            if ($timeline[$line][$col]['content'] != 0) {
                                $allOk = false;
                                break 2;
                            }
                        }

                    }
                }
                if ($allOk == true) {
                    $canPlace = true;
                } else {
                    $start_line++;
                }
            }

            if ($canPlace) {
                // Placer le bloc avec la hauteur maximale possible
                $block['start_line'] = $start_line;
                $block['end_line']   = $start_line + $block_height - 1;

                for ($line = $block['start_line']; $line <= $block['end_line']; $line++) {
                    for ($col = $block['start_column']; $col <= $block['end_column']; $col++) {
                        $timeline[$line][$col]['content'] = $block["idBlock"];
                        if ($col < $block['end_column']) {
                            $timeline[$line][$col]['notBlockBorder'] = $block["idBlock"];
                        }
                    }
                }
            }
        }
    }
    $returnValue = ['canPlace' => $canPlace, 'blocksList' => $blocksList, 'timeline' => $timeline];
    return $returnValue;
}

/**
 * Concaténer les blocs avec le même shortName, start_column, et end_column lorsqu'il y a au moins 3 blocs similaires.
 *
 * @param array $blocksList Liste des blocs générés par handleBlocksByCu().
 * @param int $minConcat Nombre minimum de blocs pour effectuer la concaténation.
 * @return array Liste des blocs après concaténation.
 */
function blocksConcat(array &$blocksList, int $minConcat): array
{
    $blockGroups = [];

    // Grouper les blocs par shortName, start_column, et end_column
    foreach ($blocksList as $block) {
        $key = $block['shortName'] . '_' . $block['start_column'] . '_' . $block['end_column'];
        if (!isset($blockGroups[$key])) {
            $blockGroups[$key] = [];
        }
        $blockGroups[$key][] = $block;
    }

    // Filtrer et fusionner les blocs qui ont au moins $minConcat éléments dans le même groupe
    foreach ($blockGroups as $key => $blocks) {
        if (count($blocks) >= $minConcat) {
            $mergedBlock           = $blocks[0];
            $mergedBlock['idList'] = [];
            $mergedBlock['text']   = "";
            $mergedBlock['merged'] = 1;
            foreach ($blocks as $block) {
                $mergedBlock['idList'] = array_merge($mergedBlock['idList'], $block['idList']);
                $mergedBlock['users']  = array_merge($mergedBlock['users'], $block['users']);
            }

            // Supprimer les blocs originaux et ajouter le bloc fusionné
            $blocksList = array_filter($blocksList, function ($block) use ($key) {
                return ($block['shortName'] . '_' . $block['start_column'] . '_' . $block['end_column']) !== $key;
            });
            $blocksList[] = $mergedBlock;
        }
    }

    return $blocksList;
}

/**
 * Vérifier si tous les blocs ont exactement les mêmes start_column et end_column.
 *
 * @param array $blocksList Liste des blocs à vérifier.
 * @return bool True si tous les blocs ont les mêmes start_column et end_column, False sinon.
 */
function hasExactSameBlocksColumns(array $blocksList): bool
{
    if (empty($blocksList)) {
        return true; // Considérer qu'une liste vide a les mêmes colonnes
    }

    // Récupérer les valeurs des start_column et end_column du premier bloc
    $firstBlock   = $blocksList[0];
    $start_column = $firstBlock['start_column'];
    $end_column   = $firstBlock['end_column'];

    // Vérifier si tous les autres blocs ont les mêmes valeurs de start_column et end_column
    foreach ($blocksList as $block) {
        if ($block['start_column'] !== $start_column || $block['end_column'] !== $end_column) {
            return false;
        }
    }

    return true;
}

function removeDuplicatesAndSortByRubis($data)
{
    // Suppression des doublons
    $unique_data = [];
    foreach ($data as $item) {
        $key               = $item['name'] . $item['tph'] . $item['rubis'];
        $unique_data[$key] = $item;
    }
    $unique_data = array_values($unique_data); // Réindexer le tableau

    // Tri par ordre de rubis
    usort($unique_data, function ($a, $b) {
        return floatval($a['rubis']) <=> floatval($b['rubis']);
    });

    return $unique_data;
}

function initializeTimeline($nbQuartHeure, $nbLinesTimeline): array
{
    $timeline = [];
    for ($j = 1; $j <= $nbLinesTimeline; $j++) {
        for ($i = 1; $i <= $nbQuartHeure; $i++) {
            $timeline[$j][$i]['content']        = 0;
            $timeline[$j][$i]['notBlockBorder'] = 0;
        }
    }
    return $timeline;
}
