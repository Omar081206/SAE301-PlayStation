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
     * Un compte par son adresse e-mail ou son pseudo, ou null s'il n'existe pas.
     *
     * Un pseudo ne contient jamais « @ », une adresse en contient toujours :
     * une même saisie ne peut pas désigner deux comptes. La collation de la
     * table ne distingue pas la casse.
     *
     * @return array<string, mixed>|null
     */
    public function trouverParIdentifiant(string $identifiant): ?array
    {
        $requetePreparee = $this->pdo->prepare(
            'SELECT id, email, pseudo, mot_de_passe, role FROM utilisateur WHERE email = :email OR pseudo = :pseudo'
        );
        $requetePreparee->bindValue(':email',  $identifiant, PDO::PARAM_STR);
        $requetePreparee->bindValue(':pseudo', $identifiant, PDO::PARAM_STR);
        $requetePreparee->execute();

        $ligne = $requetePreparee->fetch();

        if ($ligne === false) {
            return null;
        }

        // MySQL renvoie des chaînes : on convertit avant usage.
        return [
            'id'           => (int) $ligne['id'],
            'email'        => $ligne['email'],
            'pseudo'       => $ligne['pseudo'],
            'mot_de_passe' => $ligne['mot_de_passe'],
            'role'         => $ligne['role'],
        ];
    }

    /**
     * Vrai si le compte existe toujours (une session peut survivre à la
     * suppression de son compte, par exemple après une réimportation).
     */
    public function existe(int $id): bool
    {
        $requetePreparee = $this->pdo->prepare('SELECT 1 FROM utilisateur WHERE id = :id');
        $requetePreparee->bindValue(':id', $id, PDO::PARAM_INT);
        $requetePreparee->execute();

        return $requetePreparee->fetchColumn() !== false;
    }

    /**
     * Crée un compte client et renvoie son identifiant.
     *
     * @param string $empreinte Empreinte du mot de passe (password_hash), jamais
     *                          le mot de passe lui-même.
     */
    public function creer(string $email, string $pseudo, string $empreinte): int
    {
        $requetePreparee = $this->pdo->prepare(
            "INSERT INTO utilisateur (email, pseudo, mot_de_passe, role) VALUES (:email, :pseudo, :empreinte, 'client')"
        );
        $requetePreparee->bindValue(':email',     $email,     PDO::PARAM_STR);
        $requetePreparee->bindValue(':pseudo',    $pseudo,    PDO::PARAM_STR);
        $requetePreparee->bindValue(':empreinte', $empreinte, PDO::PARAM_STR);
        $requetePreparee->execute();

        return (int) $this->pdo->lastInsertId();
    }
}
