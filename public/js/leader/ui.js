// ui.js - Manejo de navegación de vistas y UI general
export class UIManager {
    static goToView(viewName) {
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });

        const targetView = document.getElementById(viewName + 'View');
        if (targetView) {
            targetView.classList.add('active');
            return viewName;
        }
    }

    static toggleHelpDrawer() {
        const drawer = document.getElementById('helpDrawer');
        const overlay = document.getElementById('helpOverlay');
        const isActive = drawer.classList.contains('active');

        if (isActive) {
            this.closeHelpDrawer();
        } else {
            drawer.classList.add('active');
            overlay.classList.add('active');
        }
    }

    static closeHelpDrawer() {
        const drawer = document.getElementById('helpDrawer');
        const overlay = document.getElementById('helpOverlay');
        drawer.classList.remove('active');
        overlay.classList.remove('active');
    }

    static toggleDarkMode() {
        const isDark = document.body.classList.toggle('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
    }

    static loadDarkMode() {
        const darkMode = localStorage.getItem('darkMode');
        if (darkMode === 'enabled') {
            document.body.classList.add('dark-mode');
            const darkModeSwitch = document.getElementById('darkModeSwitch');
            if (darkModeSwitch) {
                darkModeSwitch.checked = true;
            }
        }
    }

    static initializeTooltips() {
        const tooltipContainers = document.querySelectorAll('.tooltip-container');

        tooltipContainers.forEach(container => {
            const tooltipText = container.querySelector('.tooltip-text');
            if (!tooltipText) return;

            let tooltipTimeout;

            container.addEventListener('mouseenter', () => {
                tooltipTimeout = setTimeout(() => {
                    tooltipText.classList.add('active');
                }, 600);
            });

            container.addEventListener('mouseleave', () => {
                clearTimeout(tooltipTimeout);
                tooltipText.classList.remove('active');
            });

            container.addEventListener('touchstart', (e) => {
                e.preventDefault();
                tooltipTimeout = setTimeout(() => {
                    tooltipText.classList.add('active');
                }, 600);
            });

            container.addEventListener('touchend', () => {
                clearTimeout(tooltipTimeout);
                tooltipText.classList.remove('active');
            });
        });
    }

    static closeModalsOnBackdropClick() {
        window.onclick = function (event) {
            if (event.target.classList.contains('modal')) {
                event.target.classList.remove('active');
            }
        };
    }
}
