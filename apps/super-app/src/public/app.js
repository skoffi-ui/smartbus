const API_BASE = 'http://localhost:3000/api/v1/biotime';
const BIOTIME_IP = 'http://160.120.143.20';

async function fetchChildren() {
    const container = document.getElementById('children-container');
    try {
        const response = await fetch(`${API_BASE}/children`);
        const data = await response.json();
        
        document.getElementById('total-children').innerText = data.length;

        container.innerHTML = '';
        data.forEach(child => {
            const today = new Date().toDateString();
            const todayPunches = child.punches ? child.punches.filter(p => new Date(p.punchTime).toDateString() === today) : [];
            
            let timeInfoHTML = `<div class="status"><i class="fa-solid fa-clock"></i> En attente</div>`;
            
            if (todayPunches.length > 0) {
                // Sort chronologically
                todayPunches.sort((a, b) => new Date(a.punchTime) - new Date(b.punchTime));
                
                let punchesHTML = '';
                todayPunches.forEach(p => {
                    const d = new Date(p.punchTime);
                    const hour = d.getHours();
                    let label = (hour >= 4 && hour < 12) ? 'Montée' : ((hour >= 16 && hour < 23) ? 'Descente' : 'Pointage');
                    const timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
                    
                    let color = label === 'Montée' ? '#3b82f6' : (label === 'Descente' ? '#f59e0b' : '#10b981');
                    punchesHTML += `<span style="font-size:0.75rem; background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:4px; margin-right:6px; display:inline-block; margin-top:6px; font-weight:500;">
                        <i class="fa-solid fa-clock" style="color:${color}; margin-right:4px;"></i>${label} : ${timeStr}
                    </span>`;
                });
                timeInfoHTML = `<div>${punchesHTML}</div>`;
            }
            
            // Build absolute URL for photo if exists
            const photoUrl = child.photo && child.photo.trim() !== '' ? `${BIOTIME_IP}${child.photo}` : null;
            const photoHtml = photoUrl
                ? `<img src="${photoUrl}" class="child-photo" onerror="this.outerHTML='<div class=\\'child-photo\\'><i class=\\'fa-solid fa-user\\'></i></div>'">`
                : `<div class="child-photo"><i class="fa-solid fa-user"></i></div>`;

            const card = document.createElement('div');
            card.className = 'child-card';
            card.innerHTML = `
                ${photoHtml}
                <div class="child-info">
                    <h4>${child.firstName} ${child.lastName}</h4>
                    <span class="dept">${child.departmentName || 'Non assigné'}</span>
                    ${timeInfoHTML}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (error) {
        container.innerHTML = `<div class="loader" style="color:var(--danger)">Erreur de connexion à l'API</div>`;
        console.error(error);
    }
}

async function fetchPunches() {
    const container = document.getElementById('punches-container');
    try {
        const response = await fetch(`${API_BASE}/punches`);
        const groupedData = await response.json();
        
        let totalPunches = 0;
        Object.values(groupedData).forEach(arr => totalPunches += arr.length);
        document.getElementById('total-punches').innerText = totalPunches;

        container.innerHTML = '';
        if(totalPunches === 0) {
            container.innerHTML = `<div class="loader">Aucun pointage aujourd'hui</div>`;
            return;
        }

        for (const [dateStr, punches] of Object.entries(groupedData)) {
            // Group Header
            const dateHeader = document.createElement('div');
            dateHeader.style.padding = "12px 0 4px 0";
            dateHeader.style.fontSize = "0.85rem";
            dateHeader.style.color = "var(--accent)";
            dateHeader.style.fontWeight = "600";
            dateHeader.style.textTransform = "capitalize";
            dateHeader.innerText = dateStr;
            container.appendChild(dateHeader);

            punches.forEach(punch => {
                const isOut = punch.stateLabel === 'DESCENTE';
                const typeClass = isOut ? 'out' : 'in';
                const childName = punch.child ? `${punch.child.firstName} ${punch.child.lastName}` : 'Enfant Inconnu';
                
                const item = document.createElement('div');
                item.className = `activity-item ${typeClass}`;
                item.innerHTML = `
                    <div class="activity-time">${punch.time}</div>
                    <div class="activity-details">
                        <h4>${childName} <span style="font-size:0.7rem; padding:2px 4px; border-radius:4px; background:rgba(255,255,255,0.1); margin-left:8px;">${punch.stateLabel}</span></h4>
                        <p><i class="fa-solid fa-bus"></i> ${punch.terminal}</p>
                    </div>
                `;
                container.appendChild(item);
            });
        }
    } catch (error) {
        container.innerHTML = `<div class="loader" style="color:var(--danger)">Erreur de connexion à l'API</div>`;
        console.error(error);
    }
}

// Initial Load
fetchChildren();
fetchPunches();

// Auto refresh every 30 seconds
setInterval(() => {
    fetchChildren();
    fetchPunches();
}, 30000);

// Export Data to CSV
async function exportPunchesCSV() {
    try {
        const response = await fetch(`${API_BASE}/punches`);
        const groupedData = await response.json();
        
        let csvContent = "Date,Heure,Statut,Matricule,Nom,Prenom,Classe,Terminal\n";
        
        for (const [dateStr, punches] of Object.entries(groupedData)) {
            punches.forEach(p => {
                const child = p.child || {};
                const row = [
                    `"${dateStr}"`,
                    `"${p.time}"`,
                    `"${p.stateLabel}"`,
                    `"${child.empCode || ''}"`,
                    `"${child.lastName || ''}"`,
                    `"${child.firstName || ''}"`,
                    `"${child.className || ''}"`,
                    `"${p.terminal || ''}"`
                ];
                csvContent += row.join(",") + "\n";
            });
        }
        
        // Add UTF-8 BOM to make Excel read accents correctly
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' }); 
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `rapport_pointages_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
    } catch (error) {
        console.error("Erreur lors de l'export", error);
        alert("Erreur lors de l'export CSV");
    }
}

// Implémentation du filtre de recherche
document.addEventListener('DOMContentLoaded', () => {
    // Si l'élément est déjà là (ou après un court délai)
    const initSearch = () => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                
                // Filtrer les enfants
                const childCards = document.querySelectorAll('.child-card');
                childCards.forEach(card => {
                    const name = card.querySelector('h4') ? card.querySelector('h4').innerText.toLowerCase() : '';
                    const dept = card.querySelector('.dept') ? card.querySelector('.dept').innerText.toLowerCase() : '';
                    if (name.includes(term) || dept.includes(term)) {
                        card.style.display = '';
                    } else {
                        card.style.display = 'none';
                    }
                });

                // Filtrer les activités (pointages)
                const activityItems = document.querySelectorAll('.activity-item');
                activityItems.forEach(item => {
                    const name = item.querySelector('h4') ? item.querySelector('h4').innerText.toLowerCase() : '';
                    const details = item.querySelector('p') ? item.querySelector('p').innerText.toLowerCase() : '';
                    if (name.includes(term) || details.includes(term)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        }
    };
    
    // Initialisation immédiate et après un petit délai pour s'assurer que le DOM est prêt
    initSearch();
    setTimeout(initSearch, 500);
});
