document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const eventForm = document.getElementById('event-form');
    const eventIdInput = document.getElementById('event-id');
    const eventTitleInput = document.getElementById('event-title');
    const eventDateInput = document.getElementById('event-date');
    const eventDescriptionInput = document.getElementById('event-description');
    const eventCategorySelect = document.getElementById('event-category');
    const eventIconSelect = document.getElementById('event-icon');
    const timelineContainer = document.getElementById('timeline-container');
    const timelineTitle = document.getElementById('timeline-title');
    // Note: emptyMessage element is created dynamically if needed in renderTimeline
    const submitButton = document.getElementById('submit-button');
    const cancelEditButton = document.getElementById('cancel-edit-button');
    const exportButton = document.getElementById('export-button');
    const importFileLabel = document.querySelector('.import-button-label');
    const importFileInput = document.getElementById('import-file');
    const filterKeywordInput = document.getElementById('filter-keyword');
    const filterStartDateInput = document.getElementById('filter-start-date');
    const filterEndDateInput = document.getElementById('filter-end-date');
    const clearFiltersButton = document.getElementById('clear-filters-button');

    const STORAGE_KEY = 'chronoWeaveEnhancedTimelineEvents';

    // --- State ---
    let events = [];
    let editingEventId = null;

    // ==================================================
    // === UTILITY FUNCTION DEFINITIONS                ===
    // ==================================================

    const escapeHTML = (str) => {
        if (typeof str !== 'string') return '';
        // More robust way to escape HTML
        const element = document.createElement('div');
        element.innerText = str; // Use innerText to let the browser handle encoding
        return element.innerHTML; // Read back the encoded string
    };

    const formatDate = (dateString) => {
        // Check for valid YYYY-MM-DD format first
        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
            // console.warn("Invalid date format received:", dateString);
            return 'Invalid Date';
        }
        try {
            // Explicitly parse as UTC to avoid timezone issues if dates are meant to be absolute
            const date = new Date(dateString + 'T00:00:00Z'); // Added 'Z' for UTC
             if (isNaN(date.getTime())) { // Check if date is valid after parsing
                 // console.warn("Could not parse date:", dateString);
                 return 'Invalid Date';
             }
             // Use navigator.language for locale preference, fallback to en-US
             const userLocale = navigator.language || 'en-US';
             return date.toLocaleDateString(userLocale, {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                timeZone: 'UTC' // Display in UTC since we parsed it as UTC
            });
        } catch (e) {
            console.error("Error formatting date:", dateString, e);
            return dateString; // Fallback to original string on error
        }
    };

    // Sets the visual cue on the category dropdown
    const setCategoryColorInForm = () => {
        if (!eventCategorySelect) return; // Guard against potential null element
         try {
             const selectedOption = eventCategorySelect.options[eventCategorySelect.selectedIndex];
             const color = selectedOption ? selectedOption.dataset.color : '#ccc'; // Default color
             eventCategorySelect.style.borderLeft = `5px solid ${color || '#ccc'}`;
         } catch (e) {
            console.error("Error setting category color in form:", e);
            // Reset style on error maybe?
            eventCategorySelect.style.borderLeft = `5px solid #ccc`;
         }
    };

    // Resets the form and editing state
    const cancelEditMode = () => {
        editingEventId = null;
        eventIdInput.value = ''; // Clear hidden ID field too
        eventForm.reset(); // Resets form controls to default values defined in HTML
        submitButton.textContent = 'Add Moment';
        cancelEditButton.classList.add('hidden');
        setCategoryColorInForm(); // Reset category visual cue
        // console.log('Edit mode cancelled');
    };

    // Debounce function to limit frequency of calls (e.g., for filter input)
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args); // Use apply to preserve 'this' context if needed
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================================================
    // === DATA HANDLING (LocalStorage)              ===
    // ==================================================

    const loadEvents = () => {
        const storedEvents = localStorage.getItem(STORAGE_KEY);
        try {
            const parsedEvents = storedEvents ? JSON.parse(storedEvents) : [];
            if (Array.isArray(parsedEvents)) {
                 // Filter out any items that don't look like valid events
                 events = parsedEvents.filter(item =>
                     typeof item === 'object' && item !== null &&
                     'id' in item && typeof item.id === 'string' &&
                     'title' in item && typeof item.title === 'string' &&
                     'date' in item && typeof item.date === 'string' // Basic check
                     // Add more checks if needed (category, icon, description types)
                 );
                 // If some items were filtered, log it and save the cleaned array
                 if (events.length !== parsedEvents.length) {
                    console.warn(`Filtered out ${parsedEvents.length - events.length} invalid event structures during load.`);
                    saveEvents(); // Save the cleaned array immediately
                 }
            } else {
                // If stored data isn't an array, reset
                console.error("Stored data is not an array. Resetting timeline.");
                events = [];
                saveEvents();
            }
        } catch (e) {
            // If JSON parsing fails, reset
            console.error("Error parsing stored events from localStorage:", e);
            events = [];
            saveEvents(); // Attempt to clear corrupted storage
        }
        // console.log('Events loaded:', events.length);
    };

    const saveEvents = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
            // console.log('Events saved:', events.length);
        } catch (e) {
            console.error("Error saving to localStorage:", e);
            // Alert user if saving fails (e.g., storage full)
            alert("Error: Could not save timeline data. LocalStorage might be full or disabled.");
        }
    };

    // ==================================================
    // === RENDERING FUNCTION                        ===
    // ==================================================

    const renderTimeline = (filteredEvents = null) => {
        // Select the container where events and the axis live
        const container = document.getElementById('timeline-container');
        if (!container) {
            console.error("Timeline container not found!");
            return;
        }

        // --- Clear previous dynamic content ---
        // Select only the elements we want to remove: events and the empty message
        const dynamicElements = container.querySelectorAll('.timeline-event, #empty-timeline-message');
        dynamicElements.forEach(el => el.remove());

        // --- Ensure Axis exists ---
        let axisElement = container.querySelector('.timeline-axis');
        if (!axisElement) {
            console.log("Axis missing, creating one.");
            axisElement = document.createElement('div');
            axisElement.className = 'timeline-axis';
            container.prepend(axisElement); // Add axis at the beginning
        }

        // --- Determine events to render ---
        const eventsToRender = filteredEvents !== null ? filteredEvents : events;

        // --- Update Title ---
        if(timelineTitle) { // Check if title element exists
            timelineTitle.textContent = filteredEvents !== null ? 'Filtered Timeline' : 'Your Timeline';
        }

        // --- Handle Empty State ---
        if (eventsToRender.length === 0) {
            // Try to find existing message element or create if needed
            let emptyMsgElement = document.getElementById('empty-timeline-message');
            if (!emptyMsgElement) {
                emptyMsgElement = document.createElement('p');
                emptyMsgElement.id = 'empty-timeline-message';
                // Append after the axis or at the end if axis isn't first
                if(axisElement && axisElement.nextSibling) {
                    container.insertBefore(emptyMsgElement, axisElement.nextSibling);
                } else {
                    container.appendChild(emptyMsgElement);
                }
            }
            emptyMsgElement.className = ''; // Make visible
            axisElement?.classList.add('hidden'); // Hide axis

            // Set appropriate message
            emptyMsgElement.textContent = (events.length > 0 && filteredEvents !== null)
                ? 'No events match the current filters.'
                : 'Your timeline is empty. Add a moment to begin weaving!';
            return; // Stop rendering here if empty
        }

        // --- Render Events ---
        // Ensure empty message is hidden and axis is visible if we have events
        document.getElementById('empty-timeline-message')?.classList.add('hidden'); // Hide message if it exists
        axisElement?.classList.remove('hidden'); // Show axis

        // Sort events (more robust date comparison)
        const sortedEvents = [...eventsToRender].sort((a, b) => {
            // Handle cases where date might be missing or invalid
             const dateA = new Date(a.date + 'T00:00:00Z');
             const dateB = new Date(b.date + 'T00:00:00Z');
             const timeA = !isNaN(dateA.getTime()) ? dateA.getTime() : -Infinity; // Invalid dates sort first (or last: +Infinity)
             const timeB = !isNaN(dateB.getTime()) ? dateB.getTime() : -Infinity;
             return timeA - timeB;
        });

        // Create and append event elements
        sortedEvents.forEach((event) => {
            if (!event.id || !event.title || !event.date) {
                console.warn("Skipping rendering event due to missing id, title, or date:", event);
                return; // Skip rendering incomplete events
            }

            const eventElement = document.createElement('div');
            eventElement.classList.add('timeline-event');
            eventElement.dataset.id = event.id;
            eventElement.dataset.category = event.category || 'other';

            // Inner HTML includes escaped content and uses formatDate
            eventElement.innerHTML = `
                <div class="event-header">
                     <span class="event-icon" aria-hidden="true">${escapeHTML(event.icon || '📅')}</span>
                     <h3>${escapeHTML(event.title)}</h3>
                 </div>
                <div class="event-meta">
                    <span class="event-date">${formatDate(event.date)}</span>
                    <span class="event-category-tag">${escapeHTML(event.category || 'Other')}</span>
                </div>
                <p class="event-description">${escapeHTML(event.description || '')}</p>
                <div class="event-actions">
                    <button class="edit-btn" onclick="window.startEditEvent('${event.id}')" title="Edit Moment">Edit</button>
                    <button class="delete-btn" onclick="window.deleteEvent('${event.id}')" title="Delete Moment">Delete</button>
                </div>
            `;
            // Append the new event element to the container
            container.appendChild(eventElement);
        });
    };

    // ==================================================
    // === FILTERING FUNCTION                         ===
    // ==================================================

    const applyFilters = () => {
        // console.log('Applying filters...');
        const keyword = filterKeywordInput.value.toLowerCase().trim();
        const startDate = filterStartDateInput.value; // YYYY-MM-DD
        const endDate = filterEndDateInput.value;     // YYYY-MM-DD

        // Filter the main 'events' array based on current filter values
        const filtered = events.filter(event => {
            // Basic checks for valid event structure before filtering
            if (!event || typeof event.title !== 'string' || typeof event.description !== 'string' || typeof event.date !== 'string') {
                return false; // Exclude malformed events from filtered results
            }

            const eventDate = event.date; // Use the YYYY-MM-DD string directly

            // Keyword match (case-insensitive search in title and description)
            const titleMatch = event.title.toLowerCase().includes(keyword);
            const descriptionMatch = event.description.toLowerCase().includes(keyword);
            const keywordMatch = !keyword || titleMatch || descriptionMatch;

            // Date range match (string comparison works for YYYY-MM-DD)
            const startDateMatch = !startDate || (eventDate && eventDate >= startDate);
            const endDateMatch = !endDate || (eventDate && eventDate <= endDate);

            // Event must match all active filters
            return keywordMatch && startDateMatch && endDateMatch;
        });
        // console.log('Filtered result count:', filtered.length);
        // Render the timeline using only the filtered events
        renderTimeline(filtered);
    };

    // ==================================================
    // === EVENT LISTENER SETUP                       ===
    // ==================================================

    // --- Form Submission (Add/Update) ---
    if (eventForm) {
        eventForm.addEventListener('submit', (e) => {
            e.preventDefault(); // Prevent default form submission
            // console.log('Form submitted');

            // Get values from form fields
            const title = eventTitleInput.value.trim();
            const date = eventDateInput.value;
            const description = eventDescriptionInput.value.trim();
            const category = eventCategorySelect.value;
            const icon = eventIconSelect.value;

            // Basic validation
            if (!title || !date) {
                alert('Please provide at least a title and a date.');
                return;
            }
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                 alert('Please enter a valid date in YYYY-MM-DD format.');
                 return;
            }

            // Prepare event data object
            const eventData = { title, date, description, category, icon };

            if (editingEventId) {
                // --- Update existing event ---
                const eventIndex = events.findIndex(event => event.id === editingEventId);
                if (eventIndex > -1) {
                    // Merge existing data (like ID) with new data
                    events[eventIndex] = { ...events[eventIndex], ...eventData };
                    // console.log('Event updated:', events[eventIndex]);
                } else {
                    console.error("Couldn't find event to update with ID:", editingEventId);
                    alert("Error: Could not find the event to update."); // Inform user
                }
                cancelEditMode(); // Exit edit mode
            } else {
                // --- Add new event ---
                eventData.id = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                events.push(eventData);
                // console.log('New event added:', eventData);
            }

            saveEvents(); // Save the updated events array to localStorage
            applyFilters(); // Re-render the timeline (applies current filters)
            // Don't reset form here, cancelEditMode handles it for updates,
            // and we should reset explicitly after adding
            if (!editingEventId) { // Only reset form if we added a new event
               eventForm.reset();
               setCategoryColorInForm(); // Reset category color after form reset
            }
        });
    } else {
        console.error("Event form not found!");
    }

    // --- Cancel Edit Button ---
    if(cancelEditButton) {
        cancelEditButton.addEventListener('click', cancelEditMode);
    }

    // --- Filter Input Listeners ---
    if (filterKeywordInput) {
        // Use debounce to avoid excessive filtering on every keystroke
        filterKeywordInput.addEventListener('input', debounce(applyFilters, 300));
    }
    if (filterStartDateInput) {
        filterStartDateInput.addEventListener('change', applyFilters);
    }
    if (filterEndDateInput) {
        filterEndDateInput.addEventListener('change', applyFilters);
    }
    if (clearFiltersButton) {
        clearFiltersButton.addEventListener('click', () => {
            // Clear filter input fields
            if(filterKeywordInput) filterKeywordInput.value = '';
            if(filterStartDateInput) filterStartDateInput.value = '';
            if(filterEndDateInput) filterEndDateInput.value = '';
            // Re-apply filters (which will now be empty) to show all events
            applyFilters();
        });
    }

    // --- Category Select Visual Cue Listener ---
    if (eventCategorySelect) {
        eventCategorySelect.addEventListener('change', setCategoryColorInForm);
    }

    // --- Import / Export Button Listeners ---
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            if (events.length === 0) {
                alert("Timeline is empty. Nothing to export.");
                return;
            }
            try {
                const dataStr = JSON.stringify(events, null, 2); // Pretty print JSON
                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(dataBlob);

                // Create temporary link to trigger download
                const downloadLink = document.createElement('a');
                downloadLink.href = url;
                const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
                downloadLink.download = `chronoweave_backup_${timestamp}.json`;

                // Append, click, remove, and revoke
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                URL.revokeObjectURL(url); // Clean up blob URL
            } catch (e) {
                console.error("Error during export:", e);
                alert("An error occurred while preparing the data for export.");
            }
        });
    }

    // Label acts as the button for the hidden file input
    if (importFileLabel && importFileInput) {
         importFileLabel.addEventListener('click', (e) => {
             e.preventDefault(); // Prevent label's default behavior if any
             importFileInput.click(); // Programmatically click the hidden file input
         });

        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files ? e.target.files[0] : null;
             // Reset input value immediately allows re-importing the same file
             e.target.value = '';
            if (!file) {
                // console.log("No file selected for import.");
                return;
            }

            // Basic file type check
            if (!file.name.toLowerCase().endsWith('.json') || file.type !== 'application/json') {
                alert("Import failed: Please select a valid JSON file ending with '.json'.");
                return;
            }

            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const importedData = JSON.parse(event.target.result);

                    // Validate that the imported data is an array
                    if (!Array.isArray(importedData)) {
                        throw new Error("Imported file does not contain a valid JSON array.");
                    }

                    // Optional: Add more granular validation of each object in the array here
                    const isValidStructure = importedData.every(item =>
                        typeof item === 'object' && item !== null &&
                        'id' in item && 'title' in item && 'date' in item
                        // Add more checks as needed
                    );
                    if (!isValidStructure && importedData.length > 0) {
                        // Warn if structure seems off, but maybe allow import
                         if (!confirm("Warning: The imported file structure might be incorrect. Some events may not display properly. Continue with import?")) {
                             return; // Stop import if user cancels due to warning
                         }
                    }


                    // Final confirmation before overwriting existing data
                    if (!confirm(`Importing will REPLACE your current timeline with ${importedData.length} event(s) from the file '${file.name}'. Are you sure?`)) {
                        return; // Stop import if user cancels
                    }

                    // --- Proceed with Import ---
                    // Clear any active filters for clarity before showing imported data
                    if(filterKeywordInput) filterKeywordInput.value = '';
                    if(filterStartDateInput) filterStartDateInput.value = '';
                    if(filterEndDateInput) filterEndDateInput.value = '';

                    events = importedData; // Replace current events array
                    saveEvents(); // Save the newly imported data
                    applyFilters(); // Render the timeline with the imported data (and cleared filters)
                    alert(`Successfully imported ${importedData.length} event(s) from '${file.name}'.`);

                } catch (error) {
                    // Catch JSON parsing errors or validation errors
                    console.error("Error processing import file:", error);
                    alert(`Import failed: ${error.message}`);
                }
            };

            // Handle file reading errors
            reader.onerror = (error) => {
                console.error("Error reading file:", error);
                alert("Error: Could not read the selected file.");
            };

            // Read the file content as text
            reader.readAsText(file);
        });
    }

    // ==============================================================
    // === GLOBAL FUNCTIONS for inline onclick="" handlers        ===
    // ==============================================================
    // These need to be attached to the 'window' object to be accessible
    // directly from HTML onclick attributes.

    window.startEditEvent = (id) => {
        // console.log('Attempting to edit event ID:', id);
        const eventToEdit = events.find(event => event.id === id);
        if (!eventToEdit) {
             console.error("Event not found for editing with ID:", id);
             alert("Error: Could not find the event to edit.");
             return;
        }

        // Set global editing state
        editingEventId = id;

        // Populate form fields
        eventIdInput.value = id; // Keep track in hidden field too
        eventTitleInput.value = eventToEdit.title || '';
        eventDateInput.value = eventToEdit.date || '';
        eventDescriptionInput.value = eventToEdit.description || '';
        eventCategorySelect.value = eventToEdit.category || 'other'; // Default if missing
        eventIconSelect.value = eventToEdit.icon || '📅'; // Default if missing

        // Update UI elements for editing mode
        submitButton.textContent = 'Update Moment';
        cancelEditButton.classList.remove('hidden');
        setCategoryColorInForm(); // Update category select border color

        // Scroll form into view for better UX
        eventForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); // 'nearest' might be better than 'start'
        eventTitleInput.focus(); // Focus the title field
    };

    window.deleteEvent = (id) => {
        // console.log('Attempting to delete event ID:', id);
        const eventToDelete = events.find(event => event.id === id);
        if (!eventToDelete) {
             console.error("Event not found for deletion with ID:", id);
             alert("Error: Could not find the event to delete.");
             return;
        }

        // Confirmation dialog
        const confirmationMessage = `Are you sure you want to delete this moment?\n\n"${eventToDelete.title}" (${formatDate(eventToDelete.date)})`;
        if (!confirm(confirmationMessage)) {
            // console.log("Deletion cancelled by user.");
            return; // Stop if user cancels
        }

        // --- Proceed with Deletion ---
        // Filter out the event to be deleted
        events = events.filter(event => event.id !== id);
        saveEvents(); // Save the modified events array

        // If the deleted event was the one being edited, cancel edit mode
        if (editingEventId === id) {
            cancelEditMode();
        }

        applyFilters(); // Re-render the timeline
        // console.log('Event deleted:', id);
    };

    // ==================================================
    // === INITIAL LOAD SEQUENCE                      ===
    // ==================================================
    loadEvents(); // Load events from localStorage first
    applyFilters(); // Render the timeline (applies any default/empty filters)
    setCategoryColorInForm(); // Set initial border color for the category select

    // console.log("ChronoWeave Initialized.");

}); // End DOMContentLoaded wrapper