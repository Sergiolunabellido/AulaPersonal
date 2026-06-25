package org.example.aulapersonal.user;

import org.springframework.stereotype.Service;

@Service
public class UserService {

    private final UserRepository repositorio;


    public UserService(UserRepository repositorio) {
        this.repositorio = repositorio;
    }

    public User buscarPorEmail(String email){
        return repositorio.findByEmail(email).orElse(null);
    }
}
