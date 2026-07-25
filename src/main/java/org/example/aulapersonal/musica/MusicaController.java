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

    @GetMapping("/radios")
    public List<Map<String, Object>> radios() {
        return radioBrowser.buscarPorTag("music");
    }

    @GetMapping("/radios/buscar")
    public List<Map<String, Object>> buscar(@RequestParam String query) {
        return radioBrowser.buscar(query);
    }
}
