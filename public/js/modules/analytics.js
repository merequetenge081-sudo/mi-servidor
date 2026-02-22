/**
 * Analytics Module
 * Separates analytics functionality from main dashboard.js
 * Provides charts, statistics, and reports for performance analysis
 * 
 * Dependencies:
 * - Global: allRegistrations, allLeaders, charts
 * - Functions: getBogotaLocalidades(), isBogotaRegistration(), showAlert()
 * - External: Chart.js library, XLSX for Excel export
 */

(function() {
    'use strict';

    // ============== ANALYTICS DATA HELPERS ==============
    /**
     * Get filters from analytics UI
     */
    function getAnalyticsFilters() {
        const regionSelect = document.getElementById('analyticsRegionFilter');
        const leaderSelect = document.getElementById('analyticsLeaderFilter');
        return {
            region: regionSelect ? regionSelect.value : 'all',
            leaderId: leaderSelect ? leaderSelect.value : 'all'
        };
    }

    /**
     * Filter registrations based on selected filters
     */
    function filterAnalyticsRegistrations(filters) {
        let regs = allRegistrations;

        // Filter by Leader
        if (filters.leaderId !== 'all') {
            regs = regs.filter(r => r.leaderId === filters.leaderId);
        }

        // Filter by Region
        if (filters.region === 'bogota') {
            regs = regs.filter(r => isBogotaRegistration(r));
        } else if (filters.region === 'resto') {
            regs = regs.filter(r => !isBogotaRegistration(r));
        }

        return regs;
    }

    /**
     * Get leaders relevant to filtered registrations
     */
    function getAnalyticsLeaders(regs, filters) {
        let leaders = allLeaders;

        if (filters.leaderId !== 'all') {
            leaders = leaders.filter(l => l._id === filters.leaderId);
        } else if (filters.region !== 'all') {
            // Only show leaders with activity in filtered region
            const activeLeaderIds = new Set(regs.map(r => r.leaderId));
            leaders = leaders.filter(l => activeLeaderIds.has(l._id));
        }

        return leaders;
    }

    /**
     * Get filtered analytics data
     */
    function getAnalyticsFilteredData() {
        const filters = getAnalyticsFilters();
        const regs = filterAnalyticsRegistrations(filters);
        const leaders = getAnalyticsLeaders(regs, filters);
        const bogotaLocalidades = getBogotaLocalidades();

        return { regs, leaders, bogotaLocalidades, filters };
    }

    // ============== ANALYTICS STATS HELPERS ==============
    /**
     * Calculate aggregated statistics
     */
    function calculateAnalyticsStats(regs, leaders) {
        const bogotaRegs = regs.filter(r => isBogotaRegistration(r));
        const restoRegs = regs.filter(r => !isBogotaRegistration(r));
        const total = regs.length;
        const confirmed = regs.filter(r => r.confirmed).length;
        const rate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : 0;
        const avgRegs = leaders.length > 0 ? (total / leaders.length).toFixed(1) : 0;

        return {
            rate,
            avgRegs,
            bogotaCount: bogotaRegs.length,
            restoCount: restoRegs.length,
            bogotaRegs,
            restoRegs,
            total,
            confirmed
        };
    }

    /**
     * Update stats display cards
     */
    function updateAnalyticsStatCards(stats) {
        document.getElementById('avgConfirmRate').textContent = stats.rate + '%';
        document.getElementById('avgRegsPerLeader').textContent = stats.avgRegs;
        document.getElementById('bogotaCount').textContent = stats.bogotaCount;
        document.getElementById('restoCount').textContent = stats.restoCount;
    }

    /**
     * Calculate leader statistics for charts and tables
     */
    function calculateLeaderStats(leaders, regs, bogotaRegs, restoRegs) {
        return leaders.map(l => ({
            name: l.name.split(' ')[0],
            fullName: l.name,
            id: l._id,
            registros: regs.filter(r => r.leaderId === l._id).length,
            bogota: bogotaRegs.filter(r => r.leaderId === l._id).length,
            resto: restoRegs.filter(r => r.leaderId === l._id).length
        })).sort((a, b) => b.registros - a.registros);
    }

    // ============== ANALYTICS CHART RENDERING ==============
    /**
     * Render leader registrations bar chart
     */
    function renderLeaderRegistrationsChart(leaderStats) {
        if (charts.leaderRegs) charts.leaderRegs.destroy();
        
        const ctx = document.getElementById('leaderRegistrationsChart')?.getContext('2d');
        if (!ctx) return;

        charts.leaderRegs = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: leaderStats.map(l => l.name),
                datasets: [
                    {
                        label: 'Bogotá',
                        data: leaderStats.map(l => l.bogota),
                        backgroundColor: '#667eea',
                        borderRadius: 8
                    },
                    {
                        label: 'Resto del País',
                        data: leaderStats.map(l => l.resto),
                        backgroundColor: '#764ba2',
                        borderRadius: 8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    /**
     * Render locality distribution doughnut chart
     */
    function renderLocalityChart(regs) {
        // Aggregate localities
        const localityData = {};
        regs.forEach(r => {
            const key = r.localidad || r.departamento || 'Sin dato';
            localityData[key] = (localityData[key] || 0) + 1;
        });

        const topLocalities = Object.entries(localityData)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);

        if (charts.locality) charts.locality.destroy();
        
        const ctx = document.getElementById('localityChart')?.getContext('2d');
        if (!ctx) return;

        const colors = [
            '#667eea', '#764ba2', '#FF6B6B', '#4ECDC4', '#45B7D1',
            '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'
        ];

        charts.locality = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: topLocalities.map(l => l[0]),
                datasets: [{
                    data: topLocalities.map(l => l[1]),
                    backgroundColor: colors.slice(0, topLocalities.length),
                    borderWidth: 2,
                    borderColor: 'white'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right' } }
            }
        });
    }

    /**
     * Prepare leader detail data for table
     */
    function prepareLeaderTableData(leaders, regs) {
        return leaders.map(l => {
            const leaderRegs = regs.filter(r => r.leaderId === l._id);
            const confirmed = leaderRegs.filter(r => r.confirmed).length;
            return {
                name: l.name,
                total: leaderRegs.length,
                confirmed: confirmed,
                pending: leaderRegs.length - confirmed,
                rate: leaderRegs.length > 0 ? ((confirmed / leaderRegs.length) * 100).toFixed(1) : 0
            };
        }).sort((a, b) => b.total - a.total);
    }

    /**
     * Render analytics table
     */
    function renderLeaderAnalyticsTable() {
        const totalPages = Math.ceil(leaderAnalyticsData.length / analyticsItemsPerPage) || 1;

        if (currentAnalyticsPage > totalPages) currentAnalyticsPage = 1;
        if (currentAnalyticsPage < 1) currentAnalyticsPage = 1;

        const start = (currentAnalyticsPage - 1) * analyticsItemsPerPage;
        const end = start + analyticsItemsPerPage;
        const pageData = leaderAnalyticsData.slice(start, end);

        const tableHtml = pageData.map(l => `
            <tr>
                <td><strong>${l.name}</strong></td>
                <td><span style="background: #e3f2fd; padding: 6px 12px; border-radius: 20px; color: #667eea; font-weight: 600;">${l.total}</span></td>
                <td><span style="background: #e8f5e9; padding: 6px 12px; border-radius: 20px; color: #2e7d32; font-weight: 600;">${l.confirmed}</span></td>
                <td><span style="background: #fff3e0; padding: 6px 12px; border-radius: 20px; color: #f57c00; font-weight: 600;">${l.pending}</span></td>
                <td><strong style="color: #667eea;">${l.rate}%</strong></td>
            </tr>
        `).join('');

        document.getElementById('leaderDetailTable').innerHTML = tableHtml || '<tr><td colspan="5" class="text-center text-muted">Sin datos</td></tr>';

        // Update Controls
        document.getElementById('leaderPageIndicator').textContent = `Página ${currentAnalyticsPage} de ${totalPages}`;
        document.getElementById('prevLeaderPageBtn').disabled = currentAnalyticsPage === 1;
        document.getElementById('nextLeaderPageBtn').disabled = currentAnalyticsPage === totalPages;
    }

    /**
     * Main analytics loader - orchestrates all analytics updates
     */
    function loadAnalytics() {
        const { regs, leaders } = getAnalyticsFilteredData();
        
        // Calculate and display statistics
        const stats = calculateAnalyticsStats(regs, leaders);
        updateAnalyticsStatCards(stats);
        
        // Calculate leader statistics
        const leaderStats = calculateLeaderStats(leaders, regs, stats.bogotaRegs, stats.restoRegs);
        
        // Render charts
        renderLeaderRegistrationsChart(leaderStats);
        renderLocalityChart(regs);
        
        // Update leader details table
        leaderAnalyticsData = prepareLeaderTableData(leaders, regs);
        currentAnalyticsPage = 1;
        renderLeaderAnalyticsTable();
    }

    /**
     * Bind filter buttons
     */
    function bindAnalyticsFilters() {
        if (analyticsFiltersBound) return;
        const applyBtn = document.getElementById('applyAnalyticsFilterBtn');
        const clearBtn = document.getElementById('clearAnalyticsFilterBtn');
        const regionSelect = document.getElementById('analyticsRegionFilter');
        const leaderSelect = document.getElementById('analyticsLeaderFilter');

        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                loadAnalytics();
                analyticsLoaded = true;
            });
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                if (regionSelect) regionSelect.value = 'all';
                if (leaderSelect) leaderSelect.value = 'all';
                loadAnalytics();
                analyticsLoaded = true;
            });
        }

        analyticsFiltersBound = true;
    }

    /**
     * Initialize pagination listeners
     */
    function initAnalyticsPagination() {
        const prevBtn = document.getElementById('prevLeaderPageBtn');
        const nextBtn = document.getElementById('nextLeaderPageBtn');

        if (prevBtn && !prevBtn.analyticsListenerBound) {
            prevBtn.addEventListener('click', () => {
                if (currentAnalyticsPage > 1) {
                    currentAnalyticsPage--;
                    renderLeaderAnalyticsTable();
                }
            });
            prevBtn.analyticsListenerBound = true;
        }

        if (nextBtn && !nextBtn.analyticsListenerBound) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(leaderAnalyticsData.length / analyticsItemsPerPage) || 1;
                if (currentAnalyticsPage < totalPages) {
                    currentAnalyticsPage++;
                    renderLeaderAnalyticsTable();
                }
            });
            nextBtn.analyticsListenerBound = true;
        }
    }

    // ============== EXPOSE GLOBAL API ==============
    // Make functions available globally while keeping module scope
    window.Analytics = {
        loadAnalytics,
        bindAnalyticsFilters,
        renderLeaderAnalyticsTable,
        getAnalyticsFilteredData,
        calculateAnalyticsStats,
        prepareLeaderTableData,
        initPagination: initAnalyticsPagination
    };

    // Override global functions for backward compatibility
    window.getAnalyticsFilters = getAnalyticsFilters;
    window.filterAnalyticsRegistrations = filterAnalyticsRegistrations;
    window.getAnalyticsLeaders = getAnalyticsLeaders;
    window.getAnalyticsFilteredData = getAnalyticsFilteredData;
    window.calculateAnalyticsStats = calculateAnalyticsStats;
    window.updateAnalyticsStatCards = updateAnalyticsStatCards;
    window.calculateLeaderStats = calculateLeaderStats;
    window.renderLeaderRegistrationsChart = renderLeaderRegistrationsChart;
    window.renderLocalityChart = renderLocalityChart;
    window.prepareLeaderTableData = prepareLeaderTableData;
    window.loadAnalytics = loadAnalytics;
    window.renderLeaderAnalyticsTable = renderLeaderAnalyticsTable;
    window.bindAnalyticsFilters = bindAnalyticsFilters;

})();

// Note: Global state variables (leaderAnalyticsData, currentAnalyticsPage, etc.)
// are declared in dashboard.js, not here. This module is loaded AFTER dashboard.js
