<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Lunar\Actions\Carts\AssociateUser;
use Lunar\Facades\CartSession;

/**
 * Controlador d'autenticacio de l'API REST.
 *
 * Proporciona quatre endpoints per al cicle d'autenticacio:
 * registre d'usuaris nous, inici de sessio, tancament de sessio
 * i consulta de l'usuari autenticat. L'autenticacio es basa en
 * sessions de Laravel amb cookies (Sanctum cookie-based),
 * consumides pel frontend React.
 *
 * Endpoints:
 * - POST /api/register  -> register()  [public]
 * - POST /api/login     -> login()     [public]
 * - POST /api/logout    -> logout()    [autenticat]
 * - GET  /api/user      -> user()      [autenticat]
 *
 * @package App\Http\Controllers\Api
 */
class AuthController extends Controller
{
    /**
     * Registra un nou usuari i inicia sessio automaticament.
     *
     * Endpoint: POST /api/register (public, sense autenticacio).
     *
     * Valida nom, email (unic) i password (minim 8 caracters, confirmat),
     * crea el registre User amb el password encriptat via Hash::make(),
     * i estableix la sessio activa per a l'usuari creat.
     *
     * @param  \Illuminate\Http\Request  $request  Dades: name, email, password, password_confirmation.
     * @return \Illuminate\Http\JsonResponse Dades de l'usuari creat (id, name, email) amb HTTP 201.
     *
     * @throws \Illuminate\Validation\ValidationException Si la validacio falla (email duplicat, password curt, etc.).
     */
   public function register(Request $request)
{
    $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
    ]);

    $user = User::create([
        'name' => $request->name,
        'email' => $request->email,
        'password' => Hash::make($request->password),
    ]);

    //  Envia email verificació
    $user->sendEmailVerificationNotification();

    // Login automàtic després del registre
    Auth::login($user);

    // Associar carret de convidat si s'ha enviat cart_token
    $cartToken = $request->input('cart_token');
    if ($cartToken) {
        $guestCart = \Lunar\Models\Cart::where('meta->token', $cartToken)
            ->whereNull('user_id')
            ->active()
            ->first();

        if ($guestCart) {
            app(AssociateUser::class)->execute(
                $guestCart,
                $user,
                config('lunar.cart.auth_policy', 'merge')
            );
            $guestCart->refresh();
            CartSession::use($guestCart);
        }
    }

    return response()->json([
        'message' => 'Usuari registrat correctament. Revisa el correu per verificar el compte.',
        'data' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'email_verified_at' => $user->email_verified_at, // normalment null
        ],
    ], 201);
}

    /**
     * Inicia sessio amb credencials d'un usuari existent.
     *
     * Endpoint: POST /api/login (public, sense autenticacio).
     *
     * Valida email i password contra la base de dades. Si les credencials
     * son correctes, regenera la sessio per prevenir fixacio de sessio
     * i retorna les dades de l'usuari autenticat.
     *
     * @param  \Illuminate\Http\Request  $request  Dades: email, password.
     * @return \Illuminate\Http\JsonResponse Dades de l'usuari (id, name, email) amb HTTP 200.
     *
     * @throws \Illuminate\Validation\ValidationException Si les credencials son incorrectes.
     */
    public function login(Request $request)
    {
        $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['Les credencials són incorrectes.'],
            ]);
        }

        // Regenerar sessió per seguretat
        $request->session()->regenerate();

        $user = Auth::user();

        // Associar carret de convidat si s'ha enviat cart_token
        $cartToken = $request->input('cart_token');
        if ($cartToken) {
            $guestCart = \Lunar\Models\Cart::where('meta->token', $cartToken)
                ->whereNull('user_id')
                ->active()
                ->first();

            if ($guestCart) {
                app(AssociateUser::class)->execute(
                    $guestCart,
                    $user,
                    config('lunar.cart.auth_policy', 'merge')
                );
                $guestCart->refresh();
                CartSession::use($guestCart);
            }
        }

        return response()->json([
            'message' => 'Login correcte',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
            ],
        ]);
    }

    /**
     * Tanca la sessio de l'usuari autenticat.
     *
     * Endpoint: POST /api/logout (requereix autenticacio).
     *
     * Invalida la sessio actual i regenera el token CSRF
     * per evitar reutilitzacio de la sessio anterior.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse Confirmacio del tancament de sessio amb HTTP 200.
     */
    public function logout(Request $request)
    {
        CartSession::forget();

        Auth::guard('web')->logout();
        Auth::forgetGuards();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Sessió tancada correctament',
        ]);
    }

    /**
     * Retorna les dades del perfil de l'usuari autenticat.
     *
     * Endpoint: GET /api/user (requereix autenticacio).
     *
     * Consulta la sessio activa i retorna id, nom, email, data de verificacio
     * i data de creacio de l'usuari. Si no hi ha sessio activa, retorna HTTP 401.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse Dades de l'usuari (HTTP 200) o "No autenticat" (HTTP 401).
     */
        public function user(Request $request)
        {
            $user = $request->user();

            if (!$user) {
                return response()->json([
                    'data' => null,
                    'message' => 'No autenticat',
                ], 401);
            }

            return response()->json([
                'data' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'email_verified_at' => $user->email_verified_at,
                    'created_at' => $user->created_at,
                ],
            ]);
        }

    public function updatePassword(Request $request)
{
    $user = $request->user();

    $data = $request->validate([
        'current_password' => ['required', 'string'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
    ]);

    //  Comprovar password actual
    if (!Hash::check($data['current_password'], $user->password)) {
        throw ValidationException::withMessages([
            'current_password' => ['La contrasenya actual no és correcta.'],
        ]);
    }

    //evitar repetir la mateixa contrasenya
    if (Hash::check($data['password'], $user->password)) {
        throw ValidationException::withMessages([
            'password' => ['La nova contrasenya no pot ser igual que l’actual.'],
        ]);
    }

    $user->password = Hash::make($data['password']);
    $user->save();

    return response()->json([
        'message' => 'Contrasenya actualitzada correctament.',
    ]);
}

public function updateProfile(Request $request)
{
    $user = $request->user();

    $data = $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email,' . $user->id],
        'phone' => ['nullable', 'string', 'max:50'],
    ]);

    $emailChanged = $data['email'] !== $user->email;

    $user->name = $data['name'];
    $user->email = $data['email'];
    $user->phone = $data['phone'] ?? null;

    if ($emailChanged) {
        $user->email_verified_at = null;
    }

    $user->save();

    if ($emailChanged) {
        $user->sendEmailVerificationNotification();
    }

    return response()->json([
        'message' => 'Dades personals actualitzades correctament.',
        'data' => [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'email_verified_at' => $user->email_verified_at,
            'created_at' => $user->created_at,
        ],
    ]);
}

}
