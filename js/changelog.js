fetch('/commits.json')
  .then(res => res.json())
  .then(data => {
    const container = document.getElementById('changelog');

    // Ordenamos del más reciente al más antiguo
    data.reverse().forEach(commit => {
      const li = document.createElement('li');

      // Cabecera del commit
      const header = document.createElement('div');
      header.className = 'commit-header';

      const icon = document.createElement('span');
      icon.className = 'commit-icon';

      const msg = document.createElement('span');
      msg.innerHTML = `<strong>${commit.message}</strong>✅<span class="azul">${commit.author}</span> (${commit.date})`;

      header.appendChild(icon);
      header.appendChild(msg);

      // Toggle para mostrar archivos
      const toggle = document.createElement('span');
      toggle.className = 'toggle';
      toggle.textContent = 'Mostrar archivos';

      const filesDiv = document.createElement('div');
      filesDiv.className = 'files';
      filesDiv.style.display = 'none';

      // Asegurarse que files sea un array
      const files = Array.isArray(commit.files) ? commit.files : [];
      if(files.length > 0){
        filesDiv.innerHTML = files.map(f => `<div>${f}</div>`).join('');
      } else {
        filesDiv.innerHTML = '<div><em>No hay archivos modificados</em></div>';
      }

      toggle.onclick = () => {
        filesDiv.style.display = filesDiv.style.display === 'none' ? 'flex' : 'none';
      };

      li.appendChild(header);
      li.appendChild(toggle);
      li.appendChild(filesDiv);

      container.appendChild(li);
    });
  })
  .catch(err => console.error('Error cargando commits.json:', err));
