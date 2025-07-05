
        // Classe pour gérer les demandes d'autorisation
        class AdminDemandeHandler {
            constructor() {
                this.currentAdminId = 1; // À remplacer par l'ID réel après authentification
            }

            async loadRequests(filterStatus = 'en_attente') {
                try {
                    const response = await fetch(`./API/getDemandes.php?status=${filterStatus}`);
                    const demandes = await response.json();
                    this.displayRequests(demandes);
                } catch (error) {
                    console.error('Erreur chargement demandes:', error);
                }
            }

            displayRequests(demandes) {
                const container = document.getElementById('requests-container');
                container.innerHTML = '';

                if (demandes.length === 0) {
                    container.innerHTML = '<p class="text-gray-500">Aucune demande trouvée</p>';
                    return;
                }

                demandes.forEach(demande => {
                    const card = document.createElement('div');
                    card.className = 'request-card border rounded-lg p-4 hover:shadow-md transition-shadow';
                    
                    const statusClass = this.getStatusClass(demande.statut);
                    
                    card.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <div class="flex items-center mb-2">
                                    <span class="font-medium">Parcelle: ${demande.nom_parcelle}</span>
                                    <span class="ml-2 px-2 py-1 text-xs rounded-full ${statusClass}">
                                        ${this.getStatusText(demande.statut)}
                                    </span>
                                </div>
                                <p class="text-sm text-gray-600 mb-1">Agent: ${demande.nom_agent} (${demande.matricule_agent})</p>
                                <p class="text-sm text-gray-600">Date: ${new Date(demande.date_demande).toLocaleString()}</p>
                                ${demande.statut === 'en_attente' ? `
                                <div class="mt-3 flex space-x-2">
                                    <button class="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-sm approve-btn" data-id="${demande.id}">
                                        <i class="fas fa-check mr-1"></i> Approuver
                                    </button>
                                    <button class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm reject-btn" data-id="${demande.id}">
                                        <i class="fas fa-times mr-1"></i> Rejeter
                                    </button>
                                </div>
                                ` : ''}
                            </div>
                            <button class="text-blue-500 hover:text-blue-700 details-btn" data-id="${demande.id}">
                                <i class="fas fa-info-circle"></i> Détails
                            </button>
                        </div>
                    `;
                    
                    container.appendChild(card);
                });

                // Ajout des événements
                document.querySelectorAll('.approve-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.processRequest(e.target.closest('button').dataset.id, 'accept'));
                });

                document.querySelectorAll('.reject-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.processRequest(e.target.closest('button').dataset.id, 'reject'));
                });

                document.querySelectorAll('.details-btn').forEach(btn => {
                    btn.addEventListener('click', (e) => this.showRequestDetails(e.target.closest('button').dataset.id));
                });
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

            async processRequest(demandeId, action) {
                try {
                    const response = await fetch('./API/processDemande.php', {
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
                    console.error('Erreur traitement demande:', error);
                    alert('Une erreur est survenue');
                }
            }

            showRequestDetails(demandeId) {
                // Implémenter la vue détaillée de la demande
                console.log('Détails demande:', demandeId);
                // Pourrait ouvrir une modal avec plus d'informations
            }
        }

        // Initialisation
        const demandeHandler = new AdminDemandeHandler();

        // Gestion des onglets
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // Désactiver tous les onglets
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                
                // Activer l'onglet sélectionné
                this.classList.add('active');
                document.getElementById(`${this.dataset.tab}-tab`).classList.add('active');
            });
        });

        // Gestion des agents (existant)
        const agentForm = document.getElementById('agent-form');
        const addAgentBtn = document.getElementById('add-agent-btn');
        const cancelAgentBtn = document.getElementById('cancel-agent');
        
        addAgentBtn.addEventListener('click', () => {
            agentForm.classList.toggle('hidden');
        });
        
        cancelAgentBtn.addEventListener('click', () => {
            agentForm.classList.add('hidden');
        });

        // Filtre des demandes
        document.getElementById('apply-filter').addEventListener('click', () => {
            const status = document.getElementById('filter-status').value;
            demandeHandler.loadRequests(status === 'all' ? '' : status);
        });

        // Chargement initial
        document.addEventListener('DOMContentLoaded', () => {
            // loadAgents(); // À implémenter si nécessaire
            demandeHandler.loadRequests();
        });
