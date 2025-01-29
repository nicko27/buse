<?php
spl_autoload_register(function ($class) {
    // Préfixe de base pour notre bibliothèque
    $prefix = 'UpdateFlow\\';
    $base_dir = __DIR__ . '/';

    // Vérifie si la classe utilise le préfixe
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }

    // Obtient le chemin relatif de la classe
    $relative_class = substr($class, $len);

    // Remplace les séparateurs de namespace par des séparateurs de répertoire
    // et ajoute .php
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';

    // Si le fichier existe, le charger
    if (file_exists($file)) {
        require $file;
    }
});
