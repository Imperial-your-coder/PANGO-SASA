document.addEventListener('DOMContentLoaded', function() {
    class AdminManager {
        constructor() {
            this.currentAdminId = this.getCurrentAdminId();
            this.apiUrl = './API/AuthController.php?action=';
            this.initEventListeners();
            this.loadAgents();
            this.loadRequests();
        }

        getCurrentAdminId() {
            const authData = JSON.parse(localStorage.getItem('pango_sasa_auth'));
            return authData?.user?.id || null;
        }

        initEventListeners() {
            // Gestion des onglets
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });

            // Formulaire agent
            document.getElementById('add-agent-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('agent-form').classList.toggle('hidden');
            });

            document.getElementById('cancel-agent')?.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('agent-form').classList.add('hidden');
            });

            document.getElementById('save-agent')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.createAgent();
            });

            // Filtres demandes
            document.getElementById('apply-filter')?.addEventListener('click', () => {
                const status = document.getElementById('filter-status').value;
                this.loadRequests(status === 'all' ? null : status);
            });

            // Déconnexion
            document.getElementById('logoutBtn')?.addEventListener('click', () => {
                this.logout();
            });
        }

        async createAgent() {
            const form = document.getElementById('agent-form');
            if (!form) {
                console.error('Formulaire non trouvé');
                return;
            }

            // Récupération manuelle des valeurs
            const agentData = {
                name: form.querySelector('#agent-name').value,
                email: form.querySelector('#agent-email').value,
                password: form.querySelector('#agent-password').value,
                phone: form.querySelector('#agent-phone').value,
                matricule: form.querySelector('#agent-matricule').value,
                role: 'agent'
            };

            // Validation simple
            if (!agentData.name || !agentData.email || !agentData.password) {
                alert('Veuillez remplir les champs obligatoires');
                return;
            }

            try {
                const response = await fetch(`${this.apiUrl}create_user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agentData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Agent créé avec succès!');
                    form.reset
                    form.classList.add('hidden');
                    this.loadAgents();
                } else {
                    alert('Erreur: ' + (result.message || 'Échec de la création'));
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur réseau');
            }
        }

        // Dans la méthode loadAgents() de AdminManager.js
        async loadAgents() {
            try {
                const response = await fetch(`${this.apiUrl}list_agents`);
                const result = await response.json();
                
                if (result.success) {
                    this.displayAgents(result.users);
                    
                    // Afficher le message s'il n'y a pas d'agents
                    if (result.message && result.message.includes('Aucun agent')) {
                        const container = document.getElementById('agents-list');
                        if (container) {
                            container.innerHTML = `
                                <tr>
                                    <td colspan="5" class="p-4 text-center text-gray-500">
                                        ${result.message}
                                    </td>
                                </tr>
                            `;
                        }
                    }
                } else {
                    throw new Error(result.message || 'Erreur de chargement');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Erreur: ${error.message}`);
                
                // Afficher un message même en cas d'erreur
                const container = document.getElementById('agents-list');
                if (container) {
                    container.innerHTML = `
                        <tr>
                            <td colspan="5" class="p-4 text-center text-red-500">
                                Erreur lors du chargement des agents
                            </td>
                        </tr>
                    `;
                }
            }
        }

        displayAgents(agents) {
            const container = document.getElementById('agents-list');
            if (!container) return;

            container.innerHTML = agents.length === 0 
                ? '<tr><td colspan="5" class="p-4 text-center text-gray-500">Aucun agent enregistré</td></tr>'
                : agents.map(agent => `
                    <tr class="border-b hover:bg-gray-50">
                        <td class="p-3">${agent.name}</td>
                        <td class="p-3">${agent.email}</td>
                        <td class="p-3">${agent.matricule || '-'}</td>
                        <td class="p-3">${agent.phone || '-'}</td>
                        <td class="p-3 text-right">
                            <button class="text-blue-500 hover:text-blue-700 mr-3 edit-agent" data-id="${agent.id}">
                                <i class="fas fa-edit"></i> Modifier
                            </button>
                            <button class="text-red-500 hover:text-red-700 delete-agent" data-id="${agent.id}">
                                <i class="fas fa-trash"></i> Supprimer
                            </button>
                        </td>
                    </tr>
                `).join('');

            // Gestion des boutons
            document.querySelectorAll('.edit-agent').forEach(btn => {
                btn.addEventListener('click', () => this.editAgent(btn.dataset.id));
            });
            
            document.querySelectorAll('.delete-agent').forEach(btn => {
                btn.addEventListener('click', () => this.deleteAgent(btn.dataset.id));
            });
        }

        async editAgent(agentId) {
            try {
                // Récupérer les infos de l'agent
                const response = await fetch(`${this.apiUrl}get_agent&id=${agentId}`);
                const result = await response.json();
                
                if (result.success) {
                    const agent = result.user;
                    const form = document.getElementById('agent-form');
                    
                    // Remplir le formulaire
                    form.querySelector('[name="name"]').value = agent.name;
                    form.querySelector('[name="email"]').value = agent.email;
                    form.querySelector('[name="phone"]').value = agent.phone || '';
                    form.querySelector('[name="matricule"]').value = agent.matricule || '';
                    
                    // Changer le bouton en "Mettre à jour"
                    const saveBtn = form.querySelector('#save-agent');
                    saveBtn.textContent = 'Mettre à jour';
                    saveBtn.onclick = (e) => {
                        e.preventDefault();
                        this.updateAgent(agentId);
                    };
                    
                    // Afficher le formulaire
                    form.classList.remove('hidden');
                } else {
                    throw new Error(result.message || 'Agent non trouvé');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Erreur: ${error.message}`);
            }
        }

        async updateAgent(agentId) {
            const form = document.getElementById('agent-form');
            const formData = new FormData(form);
            
            const agentData = {
                name: formData.get('name'),
                email: formData.get('email'),
                phone: formData.get('phone'),
                matricule: formData.get('matricule')
            };

            try {
                const response = await fetch(`${this.apiUrl}update_agent&id=${agentId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agentData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Agent mis à jour avec succès!');
                    form.classList.add('hidden');
                    form.reset();
                    this.loadAgents();
                    
                    // Réinitialiser le bouton
                    const saveBtn = form.querySelector('#save-agent');
                    saveBtn.textContent = 'Enregistrer';
                    saveBtn.onclick = (e) => {
                        e.preventDefault();
                        this.createAgent();
                    };
                } else {
                    throw new Error(result.message || 'Échec de la mise à jour');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Erreur: ${error.message}`);
            }
        }

        async deleteAgent(agentId) {
            if (!confirm('Voulez-vous vraiment supprimer cet agent ?')) return;
            
            try {
                const response = await fetch(`${this.apiUrl}delete_agent&id=${agentId}`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Agent supprimé avec succès!');
                    this.loadAgents();
                } else {
                    throw new Error(result.message || 'Échec de la suppression');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Erreur: ${error.message}`);
            }
        }

        async loadRequests(status = null) {
            try {
                const url = status 
                    ? `${this.apiUrl}list_requests&status=${status}`
                    : `${this.apiUrl}list_requests`;
                    
                const response = await fetch(url);
                const result = await response.json();
                
                if (result.success !== false) {
                    this.displayRequests(result);
                } else {
                    throw new Error(result.message || 'Erreur de chargement');
                }
            } catch (error) {
                console.error('Erreur:', error);
                this.displayRequests([]);
                alert(`Erreur: ${error.message}`);
            }
        }

        displayRequests(requests) {
            const container = document.getElementById('requests-container');
            if (!container) return;

            container.innerHTML = requests.length === 0
                ? '<div class="p-4 text-center text-gray-500">Aucune demande trouvée</div>'
                : requests.map(req => {
                    const statusClass = this.getStatusClass(req.statut);
                    const statusText = this.getStatusText(req.statut);
                    const date = new Date(req.date_demande).toLocaleString();
                    
                    return `
                    <div class="request-card border rounded-lg p-4 mb-4 bg-white shadow-sm">
                        <div class="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
                            <div class="flex-1">
                                <h3 class="font-medium text-lg">Demande #${req.id}</h3>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                                    <p><span class="font-semibold">Agent:</span> ${req.nom_agent}</p>
                                    <p><span class="font-semibold">Parcelle:</span> ${req.nom_parcelle || 'ID '+req.id_parcelle}</p>
                                    <p><span class="font-semibold">Date:</span> ${date}</p>
                                    <p><span class="font-semibold">Statut:</span> 
                                        <span class="${statusClass} px-2 py-1 rounded-full text-sm">
                                            ${statusText}
                                        </span>
                                    </p>
                                </div>
                                <div class="mt-3">
                                    <p class="font-semibold">Justification:</p>
                                    <p class="text-gray-700">${req.justification}</p>
                                </div>
                            </div>
                            
                            ${req.statut === 'en_attente' ? `
                            <div class="flex flex-col space-y-2 md:w-48">
                                <button class="approve-btn px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center"
                                    data-id="${req.id}">
                                    <i class="fas fa-check mr-2"></i> Approuver
                                </button>
                                <button class="reject-btn px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center"
                                    data-id="${req.id}">
                                    <i class="fas fa-times mr-2"></i> Rejeter
                                </button>
                            </div>
                            ` : ''}
                            
                            ${req.statut === 'approuvee' ? `
                            <div class="md:w-48">
                                <button class="view-btn px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
                                    data-id="${req.id}" data-parcelle="${req.id_parcelle}">
                                    <i class="fas fa-eye mr-2"></i> Voir parcelle
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `}).join('');

            // Gestion des boutons
            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', () => this.processRequest(btn.dataset.id, 'approuvee'));
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', () => this.processRequest(btn.dataset.id, 'rejetee'));
            });
            
            document.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const parcelleId = btn.dataset.parcelle;
                    window.location.href = `parcelle.html?id=${parcelleId}`;
                });
            });
        }

        async processRequest(demandeId, action) {
            const actionText = action === 'approuvee' ? 'approuver' : 'rejeter';
            if (!confirm(`Voulez-vous vraiment ${actionText} cette demande ?`)) return;
            
            try {
                const response = await fetch(`${this.apiUrl}process_request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        demandeId: demandeId,
                        action: action,
                        adminId: this.currentAdminId
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(`Demande ${actionText} avec succès!`);
                    this.loadRequests(document.getElementById('filter-status').value);
                } else {
                    throw new Error(result.message || `Échec de l'action`);
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Erreur: ${error.message}`);
            }
        }

        getStatusClass(status) {
            switch(status) {
                case 'approuvee': return 'bg-green-100 text-green-800';
                case 'rejetee': return 'bg-red-100 text-red-800';
                default: return 'bg-yellow-100 text-yellow-800';
            }
        }

        getStatusText(status) {
            switch(status) {
                case 'approuvee': return 'Approuvée';
                case 'rejetee': return 'Rejetée';
                default: return 'En attente';
            }
        }

        switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.tab === tabName);
            });
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === `${tabName}-tab`);
            });
        }

        logout() {
            fetch(`${this.apiUrl}logout`)
                .then(() => {
                    localStorage.removeItem('pango_sasa_auth');
                    window.location.href = 'login.html';
                })
                .catch(error => {
                    console.error('Erreur déconnexion:', error);
                    alert('Erreur lors de la déconnexion');
                });
        }
    }

    // Initialisation
    new AdminManager();
});