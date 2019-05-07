module.exports = function()
{
    this.ZONE_BOOK_LIST_KEY_PREFIX = "ZONE_BOOK_LIST_";
    this.BOOK_ZONE_KEY_PREFIX = "BOOK_ZONE_";
    this.PARCEL_ACCOUNT_NUMBER_PREFIX = "ACCOUNT_NUMBER_";
    this.TREASURER_BALANCE_DUE_PREFIX = "TREASURER_BALANCE_DUE_";
    this.BALANCE_DUE_FILENAME = "balance_due_extract.txt";
    this.SHERIFF_EDIT_HISTORY_PREFIX = "SHERIFF_EDIT_HISTORY_";
    this.ZONE_EDIT_HISTORY_PREFIX = "ZONE_EDIT_HISTORY_";
    this.ZONE_ROTATION_PREFIX = "ZONE_ROTATION_";
    this.EDIT_HISTORY_FILENAME = "edit_history.tsv";
    
    this.normalizeParcelNumber = function(parcel_num)
    {
        if ( parcel_num == null ) return null;

        var sanitized_parcel = parcel_num.replace('-', '');
        while ( sanitized_parcel.indexOf('-') >= 0 )
        {
            sanitized_parcel = sanitized_parcel.replace('-', ''); // Search ignores hyphens
        }
        sanitized_parcel = sanitized_parcel.toUpperCase(); // Search ignores case

        return sanitized_parcel;
    }

    this.normalizeAccountNumber = function(account_num)
    {
        if ( account_num == null ) return null;

        return PARCEL_ACCOUNT_NUMBER_PREFIX + account_num;
    }
}