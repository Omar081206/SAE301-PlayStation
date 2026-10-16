<?php

declare(strict_types=1);

namespace App\Model;

use PDO;

/**
 * Accès aux comptes utilisateurs.
 *
 * Cette couche ne contient aucune règle métier et ne décide de rien : elle
 * ne vérifie pas les mots de passe, elle range et retrouve des empreintes.
 */
final class UtilisateurModel
{
    /** Connexion à la base, fournie à la construction. */
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    /**
     * Un compte par son adresse e-mail, ou null s'il n'existe pas.
     *
     * @return array<string, mixed>|null
     */
    public function trouverParEmail(string $email): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT id, email, mot_de_passe, role FROM utilisateur WHERE email = :email'
        );
        $requetePreparee->bindValue(':email', $email, PDO::PARAM_STR);
        $requetePreparee->execute();

        $ligne = $requetePreparee->fetch();

        if ($ligne === false) {
            return null;
        }

        // MySQL renvoie des chaînes : on convertit avant usage.
        return [
            'id'           => (int) $ligne['id'],
            'email'        => $ligne['email'],
            'mot_de_passe' => $ligne['mot_de_passe'],
            'role'         => $ligne['role'],
        ];
    }

    /**
     * Crée un compte client et renvoie son identifiant.
     *
     * @param string $empreinte Empreinte du mot de passe (password_hash), jamais
     *                          le mot de passe lui-même.
     */
    public function creer(string $email, string $empreinte): int
    {
        $requetePreparee = $this->pdo->prepare(
            "INSERT INTO utilisateur (email, mot_de_passe, role) VALUES (:email, :empreinte, 'client')"
        );
        $requetePreparee->bindValue(':email',     $email,     PDO::PARAM_STR);
        $requetePreparee->bindValue(':empreinte', $empreinte, PDO::PARAM_STR);
        $requetePreparee->execute();

        return (int) $this->pdo->lastInsertId();
    }
}
