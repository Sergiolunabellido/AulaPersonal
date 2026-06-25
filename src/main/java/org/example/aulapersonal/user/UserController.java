package org.example.aulapersonal.user;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService serviciosUsuario;

    public UserController(UserService serviciosUsuario) {
        this.serviciosUsuario = serviciosUsuario;
    }

    @GetMapping("/email")
    public User buscarPorEmail(@RequestParam String email) {
        return serviciosUsuario.buscarPorEmail(email);
    }
}
