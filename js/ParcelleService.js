// Classes conformes au diagramme
class FormulaireHTML {
    constructor() {
        this.geoJSON = '';
        this.nomParcelle = '';
    }
}

class ParcelleService {
    static async EnregistreParcelle(parcelle) {
        try {
            const response = await fetch('./API/insertData.php', {
                method: 'POST',
                body: parcelle.toFormData()
            });
            return await response.json();
        } catch (error) {
            console.error('Erreur:', error);
            throw error;
        }
    }

    static async ProprietaireExiste(id) {
        try {
            const response = await fetch(`./API/checkOwner.php?id=${id}`);
            const data = await response.json();
            return data.exists;
        } catch (error) {
            console.error('Erreur vérification propriétaire:', error);
            return false;
        }
    }

    static ValiderGeom(geom) {
        return geom && geom.length >= 3;
    }

    static async getParcelles() {
        try {
            const response = await fetch('./API/getData.php');
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('Erreur chargement parcelles:', error);
            return [];
        }
    }
}

class Proprietaire {
    constructor(id, nom, phone) {
        this.id = id;
        this.nom = nom;
        this.phone = phone;
    }
}

class Parcelle {
    constructor(id, nom, statut, geom, created_at, proprietaire = null) {
        this.id = id;
        this.nom = nom;
        this.statut = statut;
        this.geom = geom;
        this.created_at = created_at;
        this.proprietaire = proprietaire;
        this.layer = null;
        this.photo = null;
        this.area = 0;
        this.purchase_date = null;
    }

    toFormData() {
        const formData = new FormData();
        formData.append('id', this.id);
        formData.append('nom', this.nom);
        formData.append('statut', this.statut);
        formData.append('geom', JSON.stringify(this.geom));
        formData.append('area', this.area);
        
        if (this.proprietaire) {
            formData.append('proprietaire_id', this.proprietaire.id);
            formData.append('proprietaire_nom', this.proprietaire.nom);
            formData.append('proprietaire_phone', this.proprietaire.phone);
            formData.append('purchase_date', this.purchase_date);
        }
        
        if (this.photo) {
            const blob = this.dataURItoBlob(this.photo);
            formData.append('photo', blob, 'parcel-photo.jpg');
        }
        
        return formData;
    }

    dataURItoBlob(dataURI) {
        const byteString = atob(dataURI.split(',')[1]);
        const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        
        return new Blob([ab], {type: mimeString});
    }

    addToMap(mapLayer) {
        const style = {
            libre: { color: '#48bb78', fillColor: '#48bb78', fillOpacity: 0.5, weight: 3 },
            occupee: { color: '#e53e3e', fillColor: '#e53e3e', fillOpacity: 0.5, weight: 3 },
            litige: { color: '#d69e2e', fillColor: '#d69e2e', fillOpacity: 0.5, weight: 3 }
        }[this.statut];

        this.layer = L.polygon(this.geom, style).addTo(mapLayer);
        this.configureInteractions();
    }

    configureInteractions() {
        this.layer.bindTooltip(this.getTooltipContent(), {
            permanent: false, 
            sticky: true,
            direction: 'top',
            opacity: 0.9,
            className: 'custom-tooltip'
        });

        this.layer.on('click', (e) => {
            this.showInfo();
            map.setView(e.latlng, map.getZoom());
        });
    }

    getTooltipContent() {
        return `
            <div style="min-width: 150px">
                <h4 style="margin: 0 0 5px 0; font-weight: bold">${this.nom}</h4>
                <p style="margin: 0 0 3px 0"><strong>Statut:</strong> ${this.statut}</p>
                ${this.proprietaire ? `<p style="margin: 0 0 3px 0"><strong>Propriétaire:</strong> ${this.proprietaire.nom}</p>` : ''}
                <p style="margin: 0"><strong>Superficie:</strong> ${this.area} m²</p>
            </div>
        `;
    }

    showInfo() {
        const modal = document.getElementById('parcelInfoModal');
        if (!modal) {
            console.error('Modal Introuvable');
            return;
        }

        document.getElementById('parcel-info-title').textContent = this.nom;
        document.getElementById('parcel-info-id').textContent = this.id;
        document.getElementById('parcel-info-name').textContent = this.nom;
        document.getElementById('parcel-info-status').textContent = this.statut;
        document.getElementById('parcel-info-owner').textContent = this.proprietaire?.nom || '-';
        document.getElementById('parcel-info-area').textContent = this.area ? `${this.area} m²` : '-';
        document.getElementById('parcel-info-phone').textContent = this.proprietaire?.phone || '-';
        document.getElementById('parcel-info-date').textContent = this.purchase_date || '-';
        
        const avatar = document.getElementById('parcel-info-avatar');
        if (this.photo) {
            avatar.src = this.photo.startsWith('data:image') ? this.photo : `./uploads/${this.id}/${this.photo}`;
            avatar.style.display = 'block';
            avatar.onerror = () => {
                avatar.src = './assets/default-avatar.jpg';
            };
        } else {
            avatar.style.display = 'none';
        }

        const requestBtn = document.getElementById('request-modification');
        requestBtn.setAttribute('data-parcel-id', this.id);
        
        modal.style.display = 'block';
    }
}

// Application principale
document.addEventListener('DOMContentLoaded', function() {
    // Initialisation de la carte
    const map = L.map('map').setView([-4.43871, 15.2671], 19);
    const baseLayer = L.tileLayer('./{z}/{x}/{y}.png', {
        minZoom: 15,
        maxZoom: 22,
        tms: false,
        attribution: 'Créé par Elisée Nsenda'
    }).addTo(map);

    const marker = L.marker([-4.43871, 15.2671]).addTo(map);
    marker.bindPopup("<b>Commune</b><br>Annexe").openPopup();

    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        position: 'topright',
        draw: {
            polygon: {
                allowIntersection: false,
                showArea: false,
                metric: true,
                shapeOptions: {
                    color: '#ffd700',
                    fillColor: '#ffd700',
                    fillOpacity: 0.2,
                    weight: 2
                }
            },
            polyline: false,
            circle: false,
            marker: false,
            circlemarker: false,
            rectangle: false
        },
        edit: {
            featureGroup: drawnItems
        }
    });

    // Variables d'état
    let currentDrawControl = null;
    let currentParcelLayer = null;
    let currentParcelPhoto = null;
    const parcels = [];

    // Récupération des éléments DOM
    const drawBtn = document.getElementById('draw-parcel');
    const cancelDrawBtn = document.getElementById('cancel-draw');
    const parcelForm = document.getElementById('parcelForm');
    const saveParcelBtn = document.getElementById('save-parcel');
    const cancelFormBtn = document.getElementById('cancel-form');
    const avatarPreview = document.getElementById('avatar-preview');
    const ownerPhotoInput = document.getElementById('owner-photo');
    const parcelInfoModal = document.getElementById('parcelInfoModal');
    const closeInfoBtn = document.getElementById('close-info');
    const requestModBtn = document.getElementById('request-modification');
    const searchInput = document.getElementById('parcelSearch');
    const searchButton = document.getElementById('searchButton');
    const modificationRequestModal = document.getElementById('modificationRequestModal');
    const submitRequestBtn = document.getElementById('submit-request');
    const cancelRequestBtn = document.getElementById('cancel-request');
    const navbarToggle = document.getElementById('navbarToggle');
    const navbar = document.getElementById('navbar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    const toggleParcels = document.getElementById('toggleParcels');

    // Gestion des événements
    ownerPhotoInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(event) {
                avatarPreview.src = event.target.result;
                avatarPreview.style.display = 'block';
                currentParcelPhoto = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    drawBtn.addEventListener('click', function() {
        if (currentDrawControl) {
            map.removeControl(currentDrawControl);
        }
        
        currentDrawControl = drawControl;
        map.addControl(currentDrawControl);
        
        drawBtn.classList.add('hidden');
        cancelDrawBtn.classList.remove('hidden');
    });

    cancelDrawBtn.addEventListener('click', cancelDrawing);

    map.on(L.Draw.Event.CREATED, function(e) {
        const layer = e.layer;
        currentParcelLayer = layer;
        drawnItems.addLayer(layer);
        
        resetFormFields();
        parcelForm.style.display = 'block';
        
        if (currentDrawControl) {
            map.removeControl(currentDrawControl);
            currentDrawControl = null;
        }
    });

    saveParcelBtn.addEventListener('click', async function() {
        if (!currentParcelLayer) {
            alert("Veuillez d'abord dessiner une parcelle");
            return;
        }

        const status = document.getElementById('parcel-status').value;
        const name = document.getElementById('parcel-name').value;
        const area = document.getElementById('parcel-area').value;

        if (!name || !area) {
            alert('Les champs obligatoires ne sont pas remplis');
            return;
        }

        const coordinates = currentParcelLayer.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]);
        if (!ParcelleService.ValiderGeom(coordinates)) {
            alert('La géométrie de la parcelle est invalide');
            return;
        }

        const newParcelle = new Parcelle(
            null,
            name,
            status,
            coordinates,
            new Date().toISOString()
        );
        
        newParcelle.area = area;
        newParcelle.photo = currentParcelPhoto;

        if (status === 'occupee') {
            const ownerName = document.getElementById('parcel-owner').value;
            const ownerPhone = document.getElementById('parcel-phone').value;
            
            if (!ownerName) {
                alert('Le nom du propriétaire est obligatoire pour une parcelle occupée');
                return;
            }
            
            newParcelle.proprietaire = new Proprietaire(null, ownerName, ownerPhone);
            newParcelle.purchase_date = document.getElementById('parcel-date').value;
        }

        try {
            const result = await ParcelleService.EnregistreParcelle(newParcelle);
            if (result.success) {
                newParcelle.id = result.id;
                newParcelle.addToMap(drawnItems);
                parcels.push(newParcelle);
                resetForm();
                alert('Parcelle enregistrée avec succès!');
            } else {
                throw new Error(result.message || 'Erreur inconnue');
            }
        } catch (error) {
            console.error('Erreur:', error);
            alert(`Échec de l'enregistrement: ${error.message}`);
        }
    });

    cancelFormBtn.addEventListener('click', function() {
        cancelDrawing();
        parcelForm.style.display = 'none';
    });

    closeInfoBtn.addEventListener('click', function() {
        parcelInfoModal.style.display = 'none';
    });

    requestModBtn.addEventListener('click', function() {
        const parcelId = this.getAttribute('data-parcel-id');
        showModificationRequestModal(parcelId);
    });

    submitRequestBtn.addEventListener('click', submitModificationRequest);
    cancelRequestBtn.addEventListener('click', closeAllModals);

    // Fonctionnalité de recherche
    searchButton.addEventListener('click', searchParcel);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchParcel();
    });

    // Gestion de l'affichage conditionnel
    document.getElementById('parcel-status').addEventListener('change', function() {
        const occupiedFields = document.getElementById('occupied-fields');
        occupiedFields.style.display = this.value === 'occupee' ? 'block' : 'none';
    });

    // Gestion de la navbar et sidebar
    navbarToggle.addEventListener('click', function() {
        navbar.style.display = navbar.style.display === 'flex' ? 'none' : 'flex';
    });

    sidebarToggle.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
    });

    toggleParcels.addEventListener('change', function() {
        if (this.checked) {
            map.addLayer(drawnItems);
        } else {
            map.removeLayer(drawnItems);
        }
    });

    window.addEventListener('resize', function() {
        map.invalidateSize();
    });

    // Fonctions utilitaires
    function resetFormFields() {
        document.getElementById('parcel-name').value = '';
        document.getElementById('parcel-owner').value = '';
        document.getElementById('parcel-status').value = 'libre';
        document.getElementById('parcel-area').value = '';
        document.getElementById('parcel-phone').value = '';
        document.getElementById('parcel-date').value = '';
        avatarPreview.style.display = 'none';
        avatarPreview.src = '';
        ownerPhotoInput.value = '';
        currentParcelPhoto = null;
    }

    function resetForm() {
        parcelForm.style.display = 'none';
        resetFormFields();
        currentParcelLayer = null;
    }

    function cancelDrawing() {
        if (currentDrawControl) {
            map.removeControl(currentDrawControl);
            currentDrawControl = null;
        }
        
        if (currentParcelLayer) {
            drawnItems.removeLayer(currentParcelLayer);
            currentParcelLayer = null;
        }
        
        drawBtn.classList.remove('hidden');
        cancelDrawBtn.classList.add('hidden');
    }

    function searchParcel() {
        const searchTerm = searchInput.value.trim().toLowerCase();
        if (!searchTerm) {
            alert("Veuillez entrer un terme de recherche");
            return;
        }

        const foundParcels = parcels.filter(parcel => {
            if (!parcel || !parcel.layer) return false;

            const nameMatch = parcel.nom?.toLowerCase().includes(searchTerm) || false;
            const ownerMatch = parcel.proprietaire?.nom.toLowerCase().includes(searchTerm) || false;
            const idMatch = parcel.id?.toString().includes(searchTerm) || false;

            return nameMatch || ownerMatch || idMatch;
        });

        if (foundParcels.length > 0) {
            map.fitBounds(foundParcels[0].layer.getBounds());
            foundParcels.forEach(parcel => {
                const element = parcel.layer.getElement();
                if (element?.classList) {
                    element.classList.add('parcel-highlight');
                    setTimeout(() => {
                        element.classList.remove('parcel-highlight');
                    }, 1500);
                }
            });
        } else {
            alert(`Aucun résultat pour "${searchInput.value}"`);
        }
    }

    function showModificationRequestModal(parcelId) {
        document.getElementById('request-parcel-id').textContent = parcelId;
        document.getElementById('request-justification').value = '';
        modificationRequestModal.style.display = 'block';
    }

    async function submitModificationRequest() {
        const justification = document.getElementById('request-justification').value.trim();
        const parcelId = document.getElementById('request-parcel-id').textContent;
        
        if (!justification) {
            alert('Veuillez fournir une justification');
            return;
        }

        try {
            const authData = JSON.parse(localStorage.getItem('pango_sasa_auth'));
            const agentId = authData?.user?.id;
            
            if (!agentId) {
                throw new Error('Agent non identifié - Veuillez vous reconnecter');
            }

            const response = await fetch('./API/DemandeController.php?action=create', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authData.token}`
                },
                body: JSON.stringify({
                    id_parcelle: parseInt(parcelId),
                    id_agent: agentId,
                    justification: justification
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Erreur serveur');
            }

            const result = await response.json();
            if (result.success) {
                alert('Demande envoyée avec succès!');
                closeAllModals();
                updateParcelStatus(parcelId, 'en_attente');
            } else {
                throw new Error(result.message || 'Erreur lors de l\'envoi');
            }
        } catch (error) {
            console.error('Erreur détaillée:', error);
            alert(`Échec de l'envoi: ${error.message}`);
        }
    }

    function updateParcelStatus(parcelId, status) {
        const requestBtn = document.getElementById('request-modification');
        
        switch(status) {
            case 'en_attente':
                requestBtn.textContent = 'Demande en cours...';
                requestBtn.className = 'w-full px-4 py-2 bg-gray-500 text-white rounded mb-2 cursor-not-allowed';
                requestBtn.disabled = true;
                break;
                
            case 'approuvee':
                requestBtn.style.display = 'none';
                break;
                
            case 'rejetee':
                requestBtn.textContent = 'Demande rejetée - Nouvelle demande';
                requestBtn.className = 'w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 mb-2';
                requestBtn.disabled = false;
                break;
        }
    }

    function closeAllModals() {
        parcelInfoModal.style.display = 'none';
        modificationRequestModal.style.display = 'none';
    }

    async function checkInitialStatus(parcelId) {
        if (!parcelId) return;

        try {
            const response = await fetch(`./API/DemandeController.php?action=check_status&parcel_id=${parcelId}`);
            const result = await response.json();
            
            if (result.success && result.status) {
                updateParcelStatus(parcelId, result.status);
            }
        } catch (error) {
            console.error('Erreur vérification statut:', error);
        }
    }

    // Chargement initial des parcelles
    async function loadParcelsFromDatabase() {
        try {
            const parcelsData = await ParcelleService.getParcelles();
            
            parcelsData.forEach(parcelData => {
                if (parcelData.coordinates && parcelData.coordinates.length > 0) {
                    let proprietaire = null;
                    if (parcelData.owner) {
                        proprietaire = new Proprietaire(
                            parcelData.proprietaire_id,
                            parcelData.owner,
                            parcelData.phone
                        );
                    }
                    
                    const parcelle = new Parcelle(
                        parcelData.id,
                        parcelData.name,
                        parcelData.status,
                        parcelData.coordinates,
                        parcelData.created_at,
                        proprietaire
                    );
                    
                    parcelle.area = parcelData.area;
                    parcelle.photo = parcelData.photo;
                    parcelle.purchase_date = parcelData.purchase_date;
                    parcelle.addToMap(drawnItems);
                    parcels.push(parcelle);
                }
            });
        } catch (error) {
            console.error('Error loading parcels:', error);
        }
    }

    // Initialisation
    loadParcelsFromDatabase();
});