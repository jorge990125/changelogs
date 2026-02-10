// Agrega esto al inicio de tu script para depuración
console.log('Iniciando carga de commits.json...');

fetch('commits.json')
  .then(res => {
    console.log('Respuesta HTTP recibida:', res.status, res.statusText);
    console.log('URL solicitada:', res.url);
    console.log('Headers:', Object.fromEntries(res.headers.entries()));
    
    // Verificar tipo de contenido
    const contentType = res.headers.get('content-type');
    console.log('Content-Type:', contentType);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('Advertencia: La respuesta no es JSON, es:', contentType);
    }
    
    return res.text(); // Primero obtener como texto para ver el contenido crudo
  })
  .then(text => {
    console.log('Contenido crudo recibido:', text.substring(0, 500) + '...');
    
    try {
      const data = JSON.parse(text);
      console.log('JSON parseado correctamente. Número de commits:', data.length);
      console.log('Primer commit:', data[0]);
      
      // Ahora procesar los datos
      const container = document.getElementById('changelog');
      
      if (!container) {
        console.error('ERROR: No se encontró el elemento con id="changelog"');
        return;
      }
      
      // Ordenamos del más reciente al más antiguo
      const reversedData = Array.isArray(data) ? data.reverse() : [];
      
      if (reversedData.length === 0) {
        container.innerHTML = '<li>No hay commits disponibles</li>';
        return;
      }
      
      reversedData.forEach((commit, index) => {
        console.log(`Procesando commit ${index}:`, commit.message);
        
        const li = document.createElement('li');
        li.style.marginBottom = '15px';
        li.style.padding = '10px';
        li.style.border = '1px solid #ddd';
        li.style.borderRadius = '5px';

        // Cabecera del commit
        const header = document.createElement('div');
        header.className = 'commit-header';
        header.style.marginBottom = '5px';

        const msg = document.createElement('span');
        msg.innerHTML = `
          <strong>${commit.message || 'Sin mensaje'}</strong> 
          ✅ 
          <span style="color: blue">${commit.author || 'Desconocido'}</span> 
          (${commit.date || 'Sin fecha'})
        `;

        // Toggle para mostrar archivos
        const toggle = document.createElement('span');
        toggle.className = 'toggle';
        toggle.textContent = 'Mostrar archivos';
        toggle.style.marginLeft = '15px';
        toggle.style.cursor = 'pointer';
        toggle.style.color = '#0366d6';
        toggle.style.textDecoration = 'underline';

        const filesDiv = document.createElement('div');
        filesDiv.className = 'files';
        filesDiv.style.display = 'none';
        filesDiv.style.marginTop = '10px';
        filesDiv.style.padding = '10px';
        filesDiv.style.backgroundColor = '#f5f5f5';
        filesDiv.style.borderRadius = '3px';

        // Asegurarse que files sea un array
        const files = Array.isArray(commit.files) ? commit.files : [];
        if (files.length > 0) {
          filesDiv.innerHTML = files.map(f => `<div>📄 ${f}</div>`).join('');
        } else {
          filesDiv.innerHTML = '<div><em>No hay archivos modificados</em></div>';
        }

        toggle.onclick = () => {
          const isVisible = filesDiv.style.display === 'block';
          filesDiv.style.display = isVisible ? 'none' : 'block';
          toggle.textContent = isVisible ? 'Mostrar archivos' : 'Ocultar archivos';
        };

        header.appendChild(msg);
        li.appendChild(header);
        li.appendChild(toggle);
        li.appendChild(filesDiv);

        container.appendChild(li);
      });
      
      console.log('Commits cargados correctamente');
      
    } catch (parseError) {
      console.error('ERROR al parsear JSON:', parseError);
      console.error('Texto que causó el error:', text);
      
      const container = document.getElementById('changelog');
      if (container) {
        container.innerHTML = `
          <li style="color: red">
            <strong>Error en el formato JSON:</strong><br>
            ${parseError.message}<br>
            <small>${text.substring(0, 100)}...</small>
          </li>
        `;
      }
    }
  })
  .catch(err => {
    console.error('Error completo en fetch:', err);
    
    const container = document.getElementById('changelog');
    if (container) {
      container.innerHTML = `
        <li style="color: red">
          <strong>Error cargando commits:</strong><br>
          ${err.message}
        </li>
      `;
    }
  });

console.log('Solicitud fetch enviada...');