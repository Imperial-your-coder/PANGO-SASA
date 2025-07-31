document.addEventListener('DOMContentLoaded', function() {
    class AdminManager {
        constructor() {
            // Initialisation des propriétés
            this.currentAdminId = null;
            this.apiUrl = './api/AuthController.php?action=';
            
            // Initialisation des écouteurs d'événements
            this.initEventListeners();
            
            // Chargement initial des données
            this.loadAgents();
            this.loadRequests();
        }

        initEventListeners() {
            // 1. Gestion des onglets
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
            });

            // 2. Bouton "Nouvel Agent"
            document.getElementById('add-agent-btn')?.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('agent-form').classList.toggle('hidden');
            });

            // 3. Bouton "Annuler" du formulaire
            document.getElementById('cancel-agent')?.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('agent-form').classList.add('hidden');
            });

            // 4. Bouton "Enregistrer" du formulaire
            document.getElementById('save-agent')?.addEventListener('click', (e) => {
                e.preventDefault();
                this.createAgent();
            });

            // 5. Filtre des demandes
            document.getElementById('apply-filter')?.addEventListener('click', () => {
                const status = document.getElementById('filter-status').value;
                this.loadRequests(status === 'all' ? null : status);
            });

            // 6. Bouton de déconnexion
            document.getElementById('logoutBtn')?.addEventListener('click', () => {
                this.logout();
            });
        }

        // Méthode pour créer un nouvel agent
        async createAgent() {
            const agentData = {
                name: document.getElementById('agent-name').value,
                email: document.getElementById('agent-email').value,
                matricule: document.getElementById('agent-matricule').value,
                phone: document.getElementById('agent-phone').value,
                password: document.getElementById('agent-password').value,
                role: 'agent'
            };

            try {
                const response = await fetch(`${this.apiUrl}create_user`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(agentData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert('Agent créé avec succès!');
                    document.getElementById('agent-form').classList.add('hidden');
                    this.loadAgents();
                } else {
                    alert('Erreur: ' + (result.message || 'Échec de la création'));
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Erreur réseau');
            }
        }

        // Méthode pour charger la liste des agents
        async loadAgents() {
            try {
                const response = await fetch(`${this.apiUrl}list_agents`);
                const result = await response.json();
                
                if (result.success) {
                    this.displayAgents(result.users);
                } else {
                    console.error('Erreur:', result.message);
                }
            } catch (error) {
                console.error('Erreur réseau:', error);
            }
        }

        // Affichage des agents dans le tableau
        displayAgents(agents) {
            const container = document.getElementById('agents-list');
            if (!container) return;

            container.innerHTML = agents.length === 0 
                ? '<tr><td colspan="4" class="p-3 text-center">Aucun agent enregistré</td></tr>'
                : agents.map(agent => `
                    <tr class="hover:bg-gray-50">
                        <td class="p-3">${agent.name}</td>
                        <td class="p-3">${agent.matricule || '-'}</td>
                        <td class="p-3">${agent.phone || '-'}</td>
                        <td class="p-3">
                            <button class="text-blue-500 hover:text-blue-700 mr-2 edit-agent" data-id="${agent.id}">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="text-red-500 hover:text-red-700 delete-agent" data-id="${agent.id}">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');

            // Ajout des événements pour les boutons
            document.querySelectorAll('.edit-agent').forEach(btn => {
                btn.addEventListener('click', () => this.editAgent(btn.dataset.id));
            });
            
            document.querySelectorAll('.delete-agent').forEach(btn => {
                btn.addEventListener('click', () => this.deleteAgent(btn.dataset.id));
            });
        }

        // Méthode pour charger les demandes
        async loadRequests(status = null) {
            try {
                const url = status 
                    ? `${this.apiUrl}list_requests&status=${status}`
                    : `${this.apiUrl}list_requests`;
                    
                const response = await fetch(url);
                const requests = await response.json();
                this.displayRequests(requests);
            } catch (error) {
                console.error('Erreur:', error);
            }
        }

        // Affichage des demandes
        displayRequests(requests) {
            const container = document.getElementById('requests-container');
            if (!container) return;

            container.innerHTML = requests.length === 0
                ? '<p class="text-gray-500">Aucune demande trouvée</p>'
                : requests.map(req => `
                    <div class="request-card border rounded-lg p-4 mb-4">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-medium">Demande #${req.id}</h3>
                                <p class="text-sm text-gray-600">Agent: ${req.nom_agent}</p>
                                <p class="text-sm text-gray-600">Date: ${new Date(req.date_demande).toLocaleString()}</p>
                                <span class="inline-block mt-2 px-2 py-1 text-xs rounded-full ${this.getStatusClass(req.statut)}">
                                    ${this.getStatusText(req.statut)}
                                </span>
                            </div>
                            ${req.statut === 'en_attente' ? `
                            <div class="flex space-x-2">
                                <button class="approve-btn px-3 py-1 bg-green-500 text-white rounded text-sm" data-id="${req.id}">
                                    <i class="fas fa-check mr-1"></i> Approuver
                                </button>
                                <button class="reject-btn px-3 py-1 bg-red-500 text-white rounded text-sm" data-id="${req.id}">
                                    <i class="fas fa-times mr-1"></i> Rejeter
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('');

            // Gestion des boutons d'action
            document.querySelectorAll('.approve-btn').forEach(btn => {
                btn.addEventListener('click', () => this.processRequest(btn.dataset.id, 'accept'));
            });
            
            document.querySelectorAll('.reject-btn').forEach(btn => {
                btn.addEventListener('click', () => this.processRequest(btn.dataset.id, 'reject'));
            });
        }

        // Méthode pour traiter une demande (accept/reject)
        async processRequest(demandeId, action) {
            if (!confirm(`Voulez-vous vraiment ${action === 'accept' ? 'approuver' : 'rejeter'} cette demande ?`)) return;
            
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
                    this.loadRequests(document.getElementById('filter-status').value);
                } else {
                    alert('Erreur: ' + (result.message || 'Action non effectuée'));
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert('Une erreur est survenue');
            }
        }

        // Méthode pour changer d'onglet
        switchTab(tabName) {
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            document.querySelector(`.tab-btn[data-tab="${tabName}"]`).classList.add('active');
            document.getElementById(`${tabName}-tab`).classList.add('active');
        }

        // Méthode pour déconnecter l'admin
        logout() {
            fetch(`${this.apiUrl}logout`)
                .then(() => {
                    localStorage.removeItem('pango_sasa_auth');
                    window.location.href = 'login.html';
                })
                .catch(error => {
                    console.error('Erreur déconnexion:', error);
                });
        }

        // Helpers pour les statuts
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
    }

    // Initialisation
    const adminManager = new AdminManager();
});