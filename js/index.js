document.addEventListener('DOMContentLoaded', function() {
           
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

            let currentDrawControl = null;
            let currentParcel = null;
            let currentParcelPhoto = null;
            const parcels = [];

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

            cancelDrawBtn.addEventListener('click', function() {
                cancelDrawing();
            });

            function configureParcelInteractions(parcel) {
                // Tooltip au survol
                parcel.layer.bindTooltip(`
                    <div style="min-width: 150px">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold">${parcel.name}</h4>
                        <p style="margin: 0 0 3px 0"><strong>Statut:</strong> ${parcel.status}</p>
                        ${parcel.owner ? `<p style="margin: 0 0 3px 0"><strong>Propriétaire:</strong> ${parcel.owner}</p>` : ''}
                        <p style="margin: 0"><strong>Superficie:</strong> ${parcel.area} m²</p>
                    </div>
                `, {
                    permanent: false, 
                    sticky: true,
                    direction: 'top',
                    opacity: 0.9,
                    className: 'custom-tooltip'
                });

                // Clic pour afficher les détails complets
                parcel.layer.on('click', function(e) {
                    showParcelInfo(parcel);
                    map.setView(e.latlng, map.getZoom());
                });
            }



          async function saveParcelToDatabase(parcelData) {
            try {
                // Créer un FormData pour l'envoi des fichiers
                const formData = new FormData();
                
                // Ajouter les données JSON
                formData.append('data', JSON.stringify({
                    name: parcelData.name,
                    status: parcelData.status,
                    area: parcelData.area,
                    coordinates: parcelData.coordinates,
                    owner: parcelData.owner || null,
                    phone: parcelData.phone || null,
                    purchase_date: parcelData.purchase_date || null
                }));

                // Ajouter l'image si elle existe
                if (parcelData.photo) {
                    const blob = dataURItoBlob(parcelData.photo);
                    formData.append('photo', blob, 'parcel-photo.jpg');
                }

                const response = await fetch('./API/insertData.php', {
                    method: 'POST',
                    body: formData // Pas besoin de Content-Type avec FormData
                });

                if (!response.ok) {
                    throw new Error(`Erreur HTTP! Statut: ${response.status}`);
                }

                const result = await response.json();
                
                if (result.success) {
                    addParcelToMap(parcelData, result.id);
                    resetForm();
                    alert('Parcelle enregistrée avec succès!');
                    return result;
                } else {
                    throw new Error(result.message || 'Erreur inconnue');
                }
            } catch (error) {
                console.error('Erreur:', error);
                alert(`Échec de l'enregistrement: ${error.message}`);
                throw error;
            }
        }

        // Fonction utilitaire pour convertir base64 en Blob
        function dataURItoBlob(dataURI) {
            const byteString = atob(dataURI.split(',')[1]);
            const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            
            for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
            }
            
            return new Blob([ab], {type: mimeString});
        }

            function resetForm() {
                document.getElementById('parcelForm').style.display = 'none';
                document.getElementById('parcel-name').value = '';
                document.getElementById('parcel-area').value = '';
                document.getElementById('parcel-owner').value = '';
                document.getElementById('parcel-phone').value = '';
                document.getElementById('parcel-date').value = '';
                document.getElementById('owner-photo').value = '';
                avatarPreview.style.display = 'none';
                avatarPreview.src = '';
                currentParcel = null;
            }

            // Fonction pour charger les parcelles existantes
            async function loadParcelsFromDatabase() {
                try {
                    const response = await fetch('./API/getData.php');
                    
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    const text = await response.text();
                    
                    const parcelsData = JSON.parse(text);
                    
                    parcelsData.forEach(parcel => {
                        if (parcel.coordinates && parcel.coordinates.length > 0) {
                            addParcelToMap(parcel);
                            
                        }
                    });
                } catch (error) {
                    console.error('Error loading parcels:', error);
                    // Optionnel: Afficher un message à l'utilisateur
                }
            }

            // Fonction pour ajouter une parcelle à la carte
            function addParcelToMap(parcelData) {
                const style = {
                    libre: { color: '#48bb78', fillColor: '#48bb78', fillOpacity: 0.5, weight: 3 },
                    occupee: { color: '#e53e3e', fillColor: '#e53e3e', fillOpacity: 0.5, weight: 3 },
                    litige: { color: '#d69e2e', fillColor: '#d69e2e', fillOpacity: 0.5, weight: 3 }
                }[parcelData.status];

                const parcelLayer = L.polygon(parcelData.coordinates, style).addTo(drawnItems);
                
                // Création de l'objet parcelle complet
                const parcel = {
                    ...parcelData,
                    layer: parcelLayer
                };
                
                // Ajout au tableau global des parcelles
                parcels.push(parcel);
                
                // Configuration des interactions
                configureParcelInteractions(parcel);
            }

           loadParcelsFromDatabase();










            map.on(L.Draw.Event.CREATED, function(e) {
                const layer = e.layer;
                currentParcel = layer;
                drawnItems.addLayer(layer);
                
                document.getElementById('parcel-name').value = '';
                document.getElementById('parcel-owner').value = '';
                document.getElementById('parcel-status').value = 'libre';
                document.getElementById('parcel-area').value = '';
                avatarPreview.style.display = 'none';
                avatarPreview.src = '';
                ownerPhotoInput.value = '';
                currentParcelPhoto = null;
                
                parcelForm.style.display = 'block';
                
                if (currentDrawControl) {
                    map.removeControl(currentDrawControl);
                    currentDrawControl = null;
                }
            });

         saveParcelBtn.addEventListener('click', function() {
            if (!currentParcel) {
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

            const parcelData = {
                name: name,
                status: status,
                area: area,
                coordinates: currentParcel.getLatLngs()[0].map(latlng => [latlng.lat, latlng.lng]),
                photo: currentParcelPhoto
            };

            // Ajout des champs si parcelle occupée
            if (status === 'occupee') {
                parcelData.owner = document.getElementById('parcel-owner').value;
                parcelData.phone = document.getElementById('parcel-phone').value;
                parcelData.purchase_date = document.getElementById('parcel-date').value;
            }

            // Envoi des données au serveur
            saveParcelToDatabase(parcelData);
        });
        
        
        
            
        
        
            cancelFormBtn.addEventListener('click', function() {
                cancelDrawing();
                parcelForm.style.display = 'none';
            });

            closeInfoBtn.addEventListener('click', function() {
                parcelInfoModal.style.display = 'none';
            });

            requestModBtn.addEventListener('click', function() {
                alert('Demande de modification envoyée !');
                parcelInfoModal.style.display = 'none';
            });

            function cancelDrawing() {
                if (currentDrawControl) {
                    map.removeControl(currentDrawControl);
                    currentDrawControl = null;
                }
                
                if (currentParcel) {
                    drawnItems.removeLayer(currentParcel);
                    currentParcel = null;
                }
                
                drawBtn.classList.remove('hidden');
                cancelDrawBtn.classList.add('hidden');
            }

            function createParcelPopupContent(parcel) {
                return `
                    <div style="min-width: 200px">
                        <h4 style="margin: 0 0 5px 0; font-weight: bold">${parcel.name}</h4>
                        <p style="margin: 0 0 3px 0"><strong>Statut:</strong> ${parcel.status}</p>
                        <p style="margin: 0 0 3px 0"><strong>Propriétaire:</strong> ${parcel.owner}</p>
                        <p style="margin: 0"><strong>Superficie:</strong> ${parcel.area} m²</p>
                    </div>
                `;
            }

            function showParcelInfo(parcel) {
                // Vérifier que la modal existe
                const modal = document.getElementById('parcelInfoModal');
                if (!modal) {
                    console.error('Modal Introuvable');
                    return;
                }

                // Fonction helper améliorée
                function updateField(id, value, isImage = false) {
                    const element = document.getElementById(id);
                    if (!element) return;

                    if (isImage) {
                        // Gestion spéciale pour les images
                        element.onerror = function() {
                            this.src = './assets/default-avatar.jpg';
                            this.style.display = 'block';
                        };

                        if (value) {
                            element.src = value.startsWith('data:image') 
                                ? value 
                                : `./uploads/${parcel.id}/${value}`;
                            element.style.display = 'block';
                            
                            // Debug
                            console.log('Chemin image:', element.src);
                        } else {
                            element.style.display = 'none';
                        }
                    } else {
                        // Gestion standard pour les textes
                        element.textContent = value || '-';
                    }
                }

                // Mettre à jour tous les champs
                updateField('parcel-info-title', parcel.name);
                updateField('parcel-info-name', parcel.name);
                updateField('parcel-info-status', parcel.status);
                updateField('parcel-info-owner', parcel.owner);
                updateField('parcel-info-area', parcel.area ? `${parcel.area} m²` : null);
                updateField('parcel-info-phone', parcel.phone);
                updateField('parcel-info-date', parcel.purchase_date);
                updateField('parcel-info-avatar', parcel.photo, true); // true = c'est une image

                // Afficher la modal
                modal.style.display = 'block';
                modal.style.top = '20px';
                modal.style.left = '20px';
                modal.style.transform = 'none';
            }



            // Fonctionnalité de recherche
            const searchInput = document.getElementById('parcelSearch');
            const searchButton = document.getElementById('searchButton');

           function searchParcel() {
                // 1. Récupération des éléments
                const searchInput = document.getElementById('parcelSearch');
                if (!searchInput) {
                    console.error("Erreur: Champ de recherche introuvable");
                    return;
                }

                // 2. Nettoyage du terme de recherche
                const searchTerm = searchInput.value.trim();
                if (!searchTerm) {
                    alert("Veuillez entrer un terme de recherche");
                    return;
                }
                const searchTermLower = searchTerm.toLowerCase();

                // 3. Vérification des données
                if (!parcels || !Array.isArray(parcels) || parcels.length === 0) {
                    alert("Aucune donnée de parcelle disponible");
                    return;
                }

                // 4. Recherche améliorée
                const foundParcels = parcels.filter(parcel => {
                    if (!parcel || !parcel.layer) {
                        console.warn("Parcelle sans couche ignorée", parcel);
                        return false;
                    }

                    // Vérification sécurisée de toutes les propriétés
                    const nameMatch = parcel.name?.toLowerCase().includes(searchTermLower) || false;
                    const ownerMatch = parcel.owner?.toLowerCase().includes(searchTermLower) || false;
                    const idMatch = parcel.id?.toString().includes(searchTerm) || false;

                    return nameMatch || ownerMatch || idMatch;
                });

                // 5. Traitement des résultats
                if (foundParcels.length > 0) {
                    // Centrer sur la première parcelle trouvée
                    map.fitBounds(foundParcels[0].layer.getBounds());

                    // Animation de mise en évidence
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
                    alert(`Aucun résultat pour "${searchTerm}"`);
                }
            }



            // Écouteurs d'événements
            searchButton.addEventListener('click', searchParcel);
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') searchParcel();
            });



            // Gestion de l'affichage conditionnel
            document.getElementById('parcel-status').addEventListener('change', function() {
                const occupiedFields = document.getElementById('occupied-fields');
                if (this.value === 'occupee') {
                    occupiedFields.style.display = 'block';
                } else {
                    occupiedFields.style.display = 'none';
                }
            });







            window.addEventListener('resize', function() {
                map.invalidateSize();
            });

            // Nouveau code pour gérer la navbar et sidebar pliable
            const navbarToggle = document.getElementById('navbarToggle');
            const navbar = document.getElementById('navbar');
            const sidebarToggle = document.getElementById('sidebarToggle');
            const sidebar = document.getElementById('sidebar');
            const toggleParcels = document.getElementById('toggleParcels');

            // Toggle navbar
            navbarToggle.addEventListener('click', function() {
                navbar.style.display = navbar.style.display === 'flex' ? 'none' : 'flex';
            });

            // Toggle sidebar
            sidebarToggle.addEventListener('click', function() {
                sidebar.classList.toggle('collapsed');
            });

            // Toggle parcelles
            toggleParcels.addEventListener('change', function() {
                if (this.checked) {
                    map.addLayer(drawnItems);
                } else {
                    map.removeLayer(drawnItems);
                }
            });
        });
   