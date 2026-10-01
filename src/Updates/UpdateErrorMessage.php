<?php

declare(strict_types=1);

namespace Flex\Updates;

final class UpdateErrorMessage
{
    public static function forAdmin(\Throwable $exception): string
    {
        $message = trim($exception->getMessage());

        if ($message === 'The update server URL must be an HTTPS URL.') {
            return 'Адресът на update сървъра трябва да използва HTTPS.';
        }
        if ($message === 'The remote update manifest signature is required.') {
            return 'Каталогът за обновяване няма необходимия цифров подпис.';
        }
        if ($message === 'The remote update manifest signature is invalid.') {
            return 'Цифровият подпис на каталога за обновяване е невалиден.';
        }
        if ($message === 'The downloaded update package checksum does not match its manifest.') {
            return 'Checksum-ът на изтегления пакет не съвпада с каталога. Обновяването е прекъснато от съображения за сигурност.';
        }
        if ($message === 'The downloaded update package size does not match its manifest.') {
            return 'Размерът на изтегления пакет не съвпада с каталога. Обновяването е прекъснато.';
        }
        if (preg_match('/^No compatible (.+) platform update is available for (.+)\.$/', $message, $matches) === 1) {
            return sprintf('Няма съвместимо обновяване за канал „%s“ от версия %s.', $matches[1], $matches[2]);
        }
        if (preg_match('/^The directory "([^"]+)" is not writable\.$/', $message, $matches) === 1) {
            return sprintf('Директорията „%s“ не може да се записва. Проверете собственика и правата ѝ.', $matches[1]);
        }
        if (preg_match('/^The update server returned HTTP (\d+)\.$/', $message, $matches) === 1) {
            return sprintf('Update сървърът върна HTTP грешка %s. Проверете адреса и достъпността му.', $matches[1]);
        }

        return $message === ''
            ? 'Обновяването не можа да бъде изпълнено. Проверете логовете на приложението.'
            : sprintf('Обновяването не можа да бъде изпълнено. Детайли: %s', $message);
    }
}
