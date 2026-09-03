package org.example.aulapersonal.musica;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/musica")
public class MusicaController {

    private final RadioBrowserService radioBrowser;

    public MusicaController(RadioBrowserService radioBrowser) {
        this.radioBrowser = radioBrowser;
    }

    /**
     * GET /api/musica/radios
     * Lista emisoras por tag 'music' (uso por la UI de música).
     */
    @GetMapping("/radios")
    public List<Map<String, Object>> radios() {
        return radioBrowser.buscarPorTag("music");
    }

    /**
     * GET /api/musica/radios/buscar?query=...
     * Busca emisoras por nombre (forward a RadioBrowserService#buscar).
     */
    @GetMapping("/radios/buscar")
    public List<Map<String, Object>> buscar(@RequestParam String query) {
        return radioBrowser.buscar(query);
    }
}
