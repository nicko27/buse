<!DOCTYPE html>
<html lang="fr" data-theme="<?= $config['theme'] ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= htmlspecialchars($config['title']) ?></title>
    <style>
        /* Variables CSS pour les thèmes */
        :root[data-theme="light"] {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --bg-tertiary: #e9ecef;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --border-color: #dee2e6;
            --accent-color: #007bff;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --error-color: #dc3545;
            --critical-color: #6f42c1;
            --debug-color: #17a2b8;
        }

        :root[data-theme="dark"] {
            --bg-primary: #1a1a1a;
            --bg-secondary: #2d2d2d;
            --bg-tertiary: #404040;
            --text-primary: #ffffff;
            --text-secondary: #b0b0b0;
            --border-color: #555555;
            --accent-color: #0d6efd;
            --success-color: #198754;
            --warning-color: #fd7e14;
            --error-color: #dc3545;
            --critical-color: #6f42c1;
            --debug-color: #20c997;
        }

        /* Auto theme detection */
        :root[data-theme="auto"] {
            --bg-primary: #ffffff;
            --bg-secondary: #f8f9fa;
            --bg-tertiary: #e9ecef;
            --text-primary: #212529;
            --text-secondary: #6c757d;
            --border-color: #dee2e6;
            --accent-color: #007bff;
            --success-color: #28a745;
            --warning-color: #ffc107;
            --error-color: #dc3545;
            --critical-color: #6f42c1;
            --debug-color: #17a2b8;
        }

        @media (prefers-color-scheme: dark) {
            :root[data-theme="auto"] {
                --bg-primary: #1a1a1a;
                --bg-secondary: #2d2d2d;
                --bg-tertiary: #404040;
                --text-primary: #ffffff;
                --text-secondary: #b0b0b0;
                --border-color: #555555;
                --accent-color: #0d6efd;
                --success-color: #198754;
                --warning-color: #fd7e14;
                --error-color: #dc3545;
                --critical-color: #6f42c1;
                --debug-color: #20c997;
            }
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            line-height: 1.6;
            transition: background-color 0.3s, color 0.3s;
        }

        .header {
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: sticky;
            top: 0;
            z-index: 100;
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .header-controls {
            display: flex;
            gap: 1rem;
            align-items: center;
        }

        .theme-toggle {
            background: var(--bg-tertiary);
            border: 1px solid var(--border-color);
            color: var(--text-primary);
            padding: 0.5rem 1rem;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .theme-toggle:hover {
            background: var(--accent-color);
            color: white;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }

        .widget {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1.5rem;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        .widget:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .widget-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 1rem;
            color: var(--text-primary);
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 1rem;
        }

        .stat-item {
            text-align: center;
            padding: 1rem;
            background: var(--bg-tertiary);
            border-radius: 6px;
        }

        .stat-value {
            font-size: 1.8rem;
            font-weight: 700;
            margin-bottom: 0.25rem;
        }

        .stat-label {
            font-size: 0.85rem;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .level-debug { color: var(--debug-color); }
        .level-info { color: var(--accent-color); }
        .level-warning { color: var(--warning-color); }
        .level-error { color: var(--error-color); }
        .level-critical { color: var(--critical-color); }

        .logs-section {
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            overflow: hidden;
        }

        .logs-header {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
        }

        .logs-controls {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;
        }

        .filter-select, .search-input {
            padding: 0.5rem;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--bg-tertiary);
            color: var(--text-primary);
            font-size: 0.9rem;
        }

        .search-input {
            min-width: 200px;
        }

        .auto-refresh-toggle {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.9rem;
        }

        .logs-container {
            height: 600px;
            overflow-y: auto;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 0.85rem;
            line-height: 1.4;
        }

        .log-entry {
            padding: 0.5rem 1rem;
            border-bottom: 1px solid var(--border-color);
            display: flex;
            gap: 1rem;
            transition: background-color 0.1s;
        }

        .log-entry:hover {
            background: var(--bg-tertiary);
        }

        .log-timestamp {
            flex-shrink: 0;
            width: 130px;
            color: var(--text-secondary);
            font-size: 0.8rem;
        }

        .log-level {
            flex-shrink: 0;
            width: 80px;
            font-weight: 600;
            text-align: center;
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            text-transform: uppercase;
        }

        .log-level.debug { background: var(--debug-color); color: white; }
        .log-level.info { background: var(--accent-color); color: white; }
        .log-level.warning { background: var(--warning-color); color: black; }
        .log-level.error { background: var(--error-color); color: white; }
        .log-level.critical { background: var(--critical-color); color: white; }

        .log-message {
            flex: 1;
            word-break: break-word;
        }

        .status-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-size: 0.8rem;
            font-weight: 600;
            z-index: 1000;
            transition: all 0.3s;
        }

        .status-connected {
            background: var(--success-color);
            color: white;
        }

        .status-disconnected {
            background: var(--error-color);
            color: white;
        }

        .loading {
            text-align: center;
            padding: 2rem;
            color: var(--text-secondary);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }

            .header {
                padding: 1rem;
                flex-direction: column;
                gap: 1rem;
            }

            .dashboard-grid {
                grid-template-columns: 1fr;
            }

            .logs-header {
                flex-direction: column;
                align-items: stretch;
            }

            .logs-controls {
                flex-direction: column;
            }

            .log-entry {
                flex-direction: column;
                gap: 0.5rem;
            }

            .log-timestamp, .log-level {
                width: auto;
            }
        }

        /* Animations */
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .log-entry.new {
            animation: fadeIn 0.3s ease-out;
        }

        .pulse {
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    </style>
</head>
<body>
    <div class="status-indicator" id="connectionStatus">Connecté</div>

    <header class="header">
        <h1><?= htmlspecialchars($config['title']) ?></h1>
        <div class="header-controls">
            <button class="theme-toggle" onclick="toggleTheme()">🌓 Thème</button>
            <div class="auto-refresh-toggle">
                <input type="checkbox" id="autoRefresh" <?= $config['auto_refresh'] ? 'checked' : '' ?>>
                <label for="autoRefresh">Auto-refresh</label>
            </div>
        </div>
    </header>

    <div class="container">
        <!-- Dashboard Widgets -->
        <div class="dashboard-grid">
            <!-- Statistics Widget -->
            <div class="widget">
                <div class="widget-title">Statistiques</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-value"><?= $stats['total_files'] ?></div>
                        <div class="stat-label">Fichiers</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value"><?= $stats['total_size_mb'] ?>MB</div>
                        <div class="stat-label">Taille</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value"><?= array_sum($stats['by_level']) ?></div>
                        <div class="stat-label">Total logs</div>
                    </div>
                </div>
            </div>

            <!-- Logs by Level Widget -->
            <div class="widget">
                <div class="widget-title">Par niveau</div>
                <div class="stats-grid">
                    <?php foreach ($log_levels as $level): ?>
                        <div class="stat-item">
                            <div class="stat-value level-<?= $level ?>"><?= $stats['by_level'][$level] ?? 0 ?></div>
                            <div class="stat-label"><?= ucfirst($level) ?></div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <!-- Activity Widget -->
            <div class="widget">
                <div class="widget-title">Activité récente</div>
                <div class="stat-item">
                    <div class="stat-value">
                        <?php if ($stats['last_activity']): ?>
                            <?= date('H:i:s', strtotime($stats['last_activity'])) ?>
                        <?php else: ?>
                            -
                        <?php endif; ?>
                    </div>
                    <div class="stat-label">Dernière activité</div>
                </div>
            </div>

            <!-- Chart Widget (placeholder for future implementation) -->
            <div class="widget">
                <div class="widget-title">Évolution (7 derniers jours)</div>
                <div style="height: 100px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
                    <canvas id="activityChart" width="300" height="100"></canvas>
                </div>
            </div>
        </div>

        <!-- Logs Section -->
        <div class="logs-section">
            <div class="logs-header">
                <h2>Logs en temps réel</h2>
                <div class="logs-controls">
                    <select class="filter-select" id="levelFilter">
                        <option value="all">Tous niveaux</option>
                        <?php foreach ($log_levels as $level): ?>
                            <option value="<?= $level ?>"><?= ucfirst($level) ?></option>
                        <?php endforeach; ?>
                    </select>
                    
                    <?php if ($config['enable_search']): ?>
                        <input type="text" class="search-input" id="searchInput" placeholder="Rechercher...">
                    <?php endif; ?>
                    
                    <button class="theme-toggle" onclick="clearLogs()">🗑️ Vider</button>
                    
                    <?php if ($config['enable_download']): ?>
                        <button class="theme-toggle" onclick="downloadLogs()">📥 Télécharger</button>
                    <?php endif; ?>
                </div>
            </div>
            
            <div class="logs-container" id="logsContainer">
                <div class="loading">Chargement des logs...</div>
            </div>
        </div>
    </div>

    <script>
        // Configuration JavaScript
        const config = {
            autoRefresh: <?= json_encode($config['auto_refresh']) ?>,
            refreshInterval: <?= json_encode($config['refresh_interval']) ?>,
            maxLines: <?= json_encode($config['max_lines_display']) ?>,
            enableSearch: <?= json_encode($config['enable_search']) ?>
        };

        // Variables globales
        let autoRefreshInterval = null;
        let eventSource = null;
        let lastPosition = 0;
        let currentFilter = 'all';
        let searchQuery = '';
        let logsCache = [];

        // Initialisation
        document.addEventListener('DOMContentLoaded', function() {
            initializeTheme();
            loadInitialLogs();
            setupEventListeners();
            setupAutoRefresh();
            drawActivityChart();
        });

        // Gestion du thème
        function initializeTheme() {
            const savedTheme = localStorage.getItem('logviewer-theme') || 'auto';
            document.documentElement.setAttribute('data-theme', savedTheme);
        }

        function toggleTheme() {
            const currentTheme = document.documentElement.getAttribute('data-theme');
            const themes = ['light', 'dark', 'auto'];
            const currentIndex = themes.indexOf(currentTheme);
            const nextTheme = themes[(currentIndex + 1) % themes.length];
            
            document.documentElement.setAttribute('data-theme', nextTheme);
            localStorage.setItem('logviewer-theme', nextTheme);
        }

        // Event Listeners
        function setupEventListeners() {
            document.getElementById('levelFilter').addEventListener('change', function() {
                currentFilter = this.value;
                applyFilters();
            });

            if (config.enableSearch) {
                document.getElementById('searchInput').addEventListener('input', function() {
                    searchQuery = this.value;
                    applyFilters();
                });
            }

            document.getElementById('autoRefresh').addEventListener('change', function() {
                if (this.checked) {
                    startLiveStream();
                } else {
                    stopLiveStream();
                }
            });
        }

        // Chargement initial des logs
        async function loadInitialLogs() {
            try {
                const response = await fetch(`?action=api_logs&limit=100`);
                const data = await response.json();
                
                if (data.success) {
                    logsCache = data.data;
                    displayLogs(logsCache);
                    updateConnectionStatus(true);
                }
            } catch (error) {
                console.error('Erreur lors du chargement des logs:', error);
                updateConnectionStatus(false);
            }
        }

        // Live stream avec Server-Sent Events
        function startLiveStream() {
            if (eventSource) {
                stopLiveStream();
            }

            eventSource = new EventSource(`?action=stream&lastPosition=${lastPosition}&level=${currentFilter}`);
            
            eventSource.onmessage = function(event) {
                try {
                    const log = JSON.parse(event.data);
                    addNewLog(log);
                    updateConnectionStatus(true);
                } catch (error) {
                    console.error('Erreur parsing SSE:', error);
                }
            };

            eventSource.addEventListener('position', function(event) {
                const data = JSON.parse(event.data);
                lastPosition = data.position;
            });

            eventSource.onerror = function(error) {
                console.error('Erreur SSE:', error);
                updateConnectionStatus(false);
                
                // Tentative de reconnexion après 5 secondes
                setTimeout(() => {
                    if (document.getElementById('autoRefresh').checked) {
                        startLiveStream();
                    }
                }, 5000);
            };

            updateConnectionStatus(true);
        }

        function stopLiveStream() {
            if (eventSource) {
                eventSource.close();
                eventSource = null;
            }
        }

        // Auto-refresh setup
        function setupAutoRefresh() {
            if (config.autoRefresh && document.getElementById('autoRefresh').checked) {
                startLiveStream();
            }
        }

        // Affichage des logs
        function displayLogs(logs) {
            const container = document.getElementById('logsContainer');
            
            if (logs.length === 0) {
                container.innerHTML = '<div class="loading">Aucun log trouvé</div>';
                return;
            }

            let html = '';
            logs.forEach(log => {
                html += createLogEntryHTML(log);
            });

            container.innerHTML = html;
            
            // Auto-scroll vers le bas
            container.scrollTop = container.scrollHeight;
        }

        function addNewLog(log) {
            logsCache.unshift(log); // Ajouter au début
            
            // Limiter le cache
            if (logsCache.length > config.maxLines) {
                logsCache = logsCache.slice(0, config.maxLines);
            }

            // Appliquer les filtres et réafficher
            applyFilters();
        }

        function createLogEntryHTML(log) {
            const timestamp = new Date(log.timestamp * 1000).toLocaleString('fr-FR');
            const levelClass = log.level.toLowerCase();
            
            return `
                <div class="log-entry" data-level="${log.level}" data-message="${escapeHtml(log.message)}">
                    <div class="log-timestamp">${timestamp}</div>
                    <div class="log-level ${levelClass}">${log.level.toUpperCase()}</div>
                    <div class="log-message">${escapeHtml(log.message)}</div>
                </div>
            `;
        }

        // Filtrage
        function applyFilters() {
            let filteredLogs = logsCache;

            // Filtrer par niveau
            if (currentFilter !== 'all') {
                filteredLogs = filteredLogs.filter(log => log.level === currentFilter);
            }

            // Filtrer par recherche
            if (searchQuery) {
                filteredLogs = filteredLogs.filter(log => 
                    log.message.toLowerCase().includes(searchQuery.toLowerCase())
                );
            }

            displayLogs(filteredLogs);
        }

        // Utilities
        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        }

        function updateConnectionStatus(connected) {
            const indicator = document.getElementById('connectionStatus');
            if (connected) {
                indicator.textContent = 'Connecté';
                indicator.className = 'status-indicator status-connected';
            } else {
                indicator.textContent = 'Déconnecté';
                indicator.className = 'status-indicator status-disconnected';
            }
        }

        // Actions
        function clearLogs() {
            if (confirm('Vider l\'affichage des logs ?')) {
                document.getElementById('logsContainer').innerHTML = 
                    '<div class="loading">Logs vidés</div>';
                logsCache = [];
            }
        }

        function downloadLogs() {
            const date = new Date().toISOString().split('T')[0];
            const level = currentFilter;
            const format = 'txt';
            
            window.location.href = `?action=download&date=${date}&level=${level}&format=${format}`;
        }

        // Graphique d'activité simple
        function drawActivityChart() {
            const canvas = document.getElementById('activityChart');
            const ctx = canvas.getContext('2d');
            
            // Données simulées pour l'exemple
            const data = [12, 19, 15, 25, 22, 18, 24];
            const max = Math.max(...data);
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Style
            ctx.strokeStyle = getComputedStyle(document.documentElement)
                .getPropertyValue('--accent-color');
            ctx.lineWidth = 2;
            ctx.fillStyle = ctx.strokeStyle + '20';
            
            // Dessiner la courbe
            ctx.beginPath();
            data.forEach((value, index) => {
                const x = (index / (data.length - 1)) * canvas.width;
                const y = canvas.height - (value / max) * canvas.height;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // Remplir sous la courbe
            ctx.lineTo(canvas.width, canvas.height);
            ctx.lineTo(0, canvas.height);
            ctx.closePath();
            ctx.fill();
        }

        // Mise à jour périodique des statistiques
        setInterval(async function() {
            try {
                const response = await fetch('?action=api_stats');
                const data = await response.json();
                
                if (data.success) {
                    updateStats(data.stats);
                    drawActivityChart(); // Redessiner avec nouvelles données
                }
            } catch (error) {
                console.error('Erreur mise à jour stats:', error);
            }
        }, 30000); // Toutes les 30 secondes

        function updateStats(stats) {
            // Mettre à jour les widgets de statistiques
            // (Implémentation simplifiée)
            console.log('Statistiques mises à jour:', stats);
        }
    </script>
</body>
</html>
                        